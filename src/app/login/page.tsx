import { login } from "@/app/actions";
export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="mx-auto mt-24 max-w-sm px-4">
      <div className="card p-6">
        <h1 className="text-xl font-bold">FPC-MS</h1>
        <p className="mb-4 mt-1 text-sm text-muted">Enter the team password to continue.</p>
        <form action={login} className="space-y-3">
          <input className="input" type="password" name="password" placeholder="Password" autoFocus required aria-label="Password" />
          {e && <p className="text-sm text-bad">That password is not right.</p>}
          <button className="btn btn-primary w-full justify-center">Sign in</button>
        </form>
      </div>
    </div>
  );
}
