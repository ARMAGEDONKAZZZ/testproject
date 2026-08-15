import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthSplitLayout } from "./components/AuthSplitLayout";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { toast } from "@/components/Toast";
import { ApiError } from "@/api/client";
import { useLogin } from "@/features/auth/hooks";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleSubmit() {
    setPasswordError(null);
    if (!email || !password) {
      toast.error("Введите email и пароль");
      return;
    }
    try {
      await login.mutateAsync({ email, password });
      navigate("/generate", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "WRONG_PASSWORD") {
        setPasswordError(t("auth.wrongPassword"));
        return;
      }
      toast.error(err instanceof ApiError ? err.message : t("common.errorGeneric"));
    }
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold text-text-primary">{t("auth.loginTitle")}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t("auth.loginSubtitle")}</p>

      <div className="mt-6 space-y-4">
        <Input
          label={t("auth.emailLabel")}
          type="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <Input
            label={t("auth.passwordLabel")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError ?? undefined}
          />
          <div className="mt-1 text-right">
            <Link to="/auth/forgot-password" className="text-sm text-accent-green">
              {t("auth.forgotPassword")}
            </Link>
          </div>
        </div>
        <Button className="w-full" loading={login.isPending} onClick={() => void handleSubmit()}>
          {t("auth.login")}
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-text-secondary">
        {t("auth.noAccount")}{" "}
        <Link to="/auth/register" className="text-accent-green">
          {t("auth.register")}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
