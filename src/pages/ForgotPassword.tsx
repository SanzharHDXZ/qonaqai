import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import QonaqLogo from "@/components/QonaqLogo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await resetPassword(email);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <QonaqLogo linkTo="/" size="lg" className="justify-center" />
          <h1 className="mt-6 text-2xl font-display font-bold">Reset password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
            <p className="text-sm">If an account exists for <strong>{email}</strong>, we sent a password reset link.</p>
            <Link to="/login"><Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-3 w-3" /> Back to login</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hotel.com" required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send Reset Link"}
            </Button>
            <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="inline h-3 w-3 mr-1" /> Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
