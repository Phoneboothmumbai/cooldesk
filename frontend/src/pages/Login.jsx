import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Snowflake } from "@phosphor-icons/react";

const BG =
  "https://images.unsplash.com/photo-1488972685288-c3fd157d7c7a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwYWJzdHJhY3QlMjBhcmNoaXRlY3R1cmV8ZW58MHx8fHwxNzg4OTcwNzgyfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="hidden bg-[#0B1221] md:block">
        <div className="relative h-full">
          <img src={BG} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 flex flex-col justify-between p-12">
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
                <Snowflake size={20} weight="fill" />
              </div>
              <span className="font-heading text-xl font-extrabold tracking-tight">CoolDesk</span>
            </div>
            <div>
              <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white">
                Brand-routed AC service desk
              </h2>
              <p className="mt-3 max-w-md text-sm text-white/70">
                Every complaint auto-notifies the right brand stakeholders. Track, assign and resolve
                from one place.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-16">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Staff access</p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-[#52525B]">Admins and agents only.</p>

          {error && (
            <div
              data-testid="login-error"
              className="mt-6 rounded-md border border-[#F9C6CC] bg-[#FDECEE] px-3 py-2 text-sm text-[#E63946]"
            >
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Email</Label>
              <Input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Password</Label>
              <Input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <Button data-testid="login-submit-button" type="submit" disabled={loading} className="mt-6 w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <a href="/" className="mt-4 block text-center text-sm text-[#52525B] hover:text-primary">
            ← Back to dealer form
          </a>
        </form>
      </div>
    </div>
  );
}
