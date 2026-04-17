-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUMs
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE client_status AS ENUM ('Em análise', 'Aprovado', 'Rejeitado', 'Aguardando caixa');
CREATE TYPE client_type AS ENUM ('ouro', 'medio', 'ruim');
CREATE TYPE loan_type AS ENUM ('simple', 'installment');
CREATE TYPE loan_status AS ENUM ('active', 'paid', 'overdue');
CREATE TYPE payment_status AS ENUM ('paid', 'pending');
CREATE TYPE payment_type AS ENUM ('full', 'partial', 'interest');

-- Create Users Table
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role user_role DEFAULT 'user'::user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create Clients Table
CREATE TABLE public.clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    selfie_url TEXT,
    address TEXT,
    requested_amount DECIMAL(12,2),
    monthly_income DECIMAL(12,2),
    observation TEXT,
    status client_status DEFAULT 'Em análise'::client_status NOT NULL,
    client_type client_type,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create Loans Table
CREATE TABLE public.loans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    type loan_type NOT NULL,
    principal DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    remaining_amount DECIMAL(12,2) NOT NULL,
    installments INTEGER,
    installment_value DECIMAL(12,2),
    status loan_status DEFAULT 'active'::loan_status NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    next_due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create Payments Table
CREATE TABLE public.payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    status payment_status DEFAULT 'paid'::payment_status NOT NULL,
    type payment_type,
    is_late BOOLEAN DEFAULT false,
    days_late INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create Settings Table
CREATE TABLE public.settings (
    id TEXT PRIMARY KEY,
    tema TEXT DEFAULT 'escuro',
    cor_primaria TEXT DEFAULT '#10b981',
    notificacao_email BOOLEAN DEFAULT true,
    biometria BOOLEAN DEFAULT false,
    available_capital DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default settings
INSERT INTO public.settings (id, available_capital) VALUES ('app', 0) ON CONFLICT DO NOTHING;

-- Create Deleted Clients Table (Audit log)
CREATE TABLE public.deleted_clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    original_id UUID NOT NULL,
    name TEXT NOT NULL,
    cpf TEXT NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_by UUID REFERENCES auth.users(id)
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 1. Users Policies
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Clients Policies
CREATE POLICY "Admins can manage all clients" ON public.clients FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Enable public registration" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Clients can view their own data (by CPF/Email match if linked)" ON public.clients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (email = public.clients.email OR role = 'admin'))
);

-- 3. Loans Policies
CREATE POLICY "Admins can manage all loans" ON public.loans FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can view their own loans" ON public.loans FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = public.loans.client_id 
    AND (email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  )
);

-- 4. Payments Policies
CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Settings Policies
CREATE POLICY "Everyone can view settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Only admins can update settings" ON public.settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 6. Deleted Clients (Audit log)
CREATE POLICY "Only admins can view audit log" ON public.deleted_clients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Create function to automatically update 'updated_at' on clients
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function for Credit Intelligence (Server-side calculation)
CREATE OR REPLACE FUNCTION get_client_intelligence()
RETURNS TABLE (
    client_id UUID,
    name TEXT,
    cpf TEXT,
    score NUMERIC,
    classification TEXT,
    suggested_limit NUMERIC,
    on_time_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH client_stats AS (
        SELECT 
            c.id,
            c.name,
            c.cpf,
            COUNT(l.id) as total_loans,
            COALESCE(AVG(CASE WHEN p.is_late THEN 0 ELSE 100 END), 80) as on_time_pct
        FROM public.clients c
        LEFT JOIN public.loans l ON l.client_id = c.id
        LEFT JOIN public.payments p ON p.loan_id = l.id
        GROUP BY c.id, c.name, c.cpf
    )
    SELECT 
        id as client_id,
        name,
        cpf,
        on_time_pct as score,
        CASE 
            WHEN on_time_pct >= 95 THEN 'Ouro'
            WHEN on_time_pct >= 85 THEN 'Bom'
            WHEN on_time_pct >= 70 THEN 'Médio'
            ELSE 'Risco'
        END as classification,
        CASE 
            WHEN on_time_pct >= 95 THEN 2500
            WHEN on_time_pct >= 85 THEN 2000
            WHEN on_time_pct >= 70 THEN 1250
            ELSE 500
        END as suggested_limit,
        on_time_pct as on_time_percentage
    FROM client_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
