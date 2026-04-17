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

-- Create Policies (Simplified for Admin access based on the prototype)
-- In production, you would check if the user has the 'admin' role in public.users
CREATE POLICY "Enable read access for all authenticated users" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.loans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.deleted_clients FOR ALL USING (auth.role() = 'authenticated');

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
