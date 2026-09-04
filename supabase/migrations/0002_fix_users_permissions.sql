GRANT SELECT ON TABLE public.users TO authenticated;

CREATE POLICY "Users can create their own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND role = 'user'::user_role
);

CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = 'user'::user_role
);

INSERT INTO public.users (id, email, role)
SELECT id, email, 'admin'::user_role
FROM auth.users
WHERE lower(email) = 'michaeldsandes@gmail.com'
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  role = 'admin'::user_role;

-- Do not query public.users from other RLS policies. That causes permission
-- failures when PostgREST evaluates policies for clients, loans and payments.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
CREATE POLICY "Admins can view all profiles"
ON public.users
FOR SELECT
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com');

DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
CREATE POLICY "Admins can manage all clients"
ON public.clients
FOR ALL
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com')
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com');

DROP POLICY IF EXISTS "Clients can view their own data (by CPF/Email match if linked)" ON public.clients;
CREATE POLICY "Clients can view their own data (by email)"
ON public.clients
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com'
);

DROP POLICY IF EXISTS "Admins can manage all loans" ON public.loans;
CREATE POLICY "Admins can manage all loans"
ON public.loans
FOR ALL
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com')
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com');

DROP POLICY IF EXISTS "Users can view their own loans" ON public.loans;
CREATE POLICY "Users can view their own loans"
ON public.loans
FOR SELECT
TO authenticated
USING (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com'
  OR EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = public.loans.client_id
      AND lower(client.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;
CREATE POLICY "Admins can manage all payments"
ON public.payments
FOR ALL
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com')
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com');

DROP POLICY IF EXISTS "Only admins can update settings" ON public.settings;
CREATE POLICY "Only admins can update settings"
ON public.settings
FOR UPDATE
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com')
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com');

DROP POLICY IF EXISTS "Only admins can view audit log" ON public.deleted_clients;
CREATE POLICY "Only admins can view audit log"
ON public.deleted_clients
FOR SELECT
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michaeldsandes@gmail.com');

-- These legacy policies call is_admin(), which queries public.users while RLS
-- is being evaluated and prevents the dashboard from loading.
DROP POLICY IF EXISTS "Admin gerencia clientes" ON public.clients;
DROP POLICY IF EXISTS "Cliente autenticado vê seus dados" ON public.clients;
DROP POLICY IF EXISTS "Admins gerenciam empréstimos" ON public.loans;
DROP POLICY IF EXISTS "Admins gerenciam pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Apenas admin edita config" ON public.settings;
DROP POLICY IF EXISTS "Apenas admin vê auditoria" ON public.deleted_clients;
