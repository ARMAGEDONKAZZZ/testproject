import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { Pencil, LogOut, Trash } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { useMe, useChangePassword, useDeleteAccount } from "@/features/profile/hooks";
import { useSessionStore } from "@/features/auth/session";
import { EditProfileModal } from "./components/EditProfileModal";
import { SkillsPentagon } from "./components/SkillsPentagon";

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();
  const clear = useSessionStore((s) => s.clear);

  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading || !me) {
    return <div className="p-10 text-center text-text-secondary">{t("common.loading")}</div>;
  }

  const isAdult = me.email !== undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-bold text-text-primary">{t("profile.title")}</h1>

      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-violet text-lg font-semibold text-white">
            {me.nickname.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="font-medium text-text-primary">{me.nickname}</p>
            <p className="text-xs text-text-muted">ID: {me.id.slice(0, 8)}</p>
          </div>
        </div>
        <button onClick={() => setEditOpen(true)} className="text-text-secondary hover:text-text-primary">
          <Pencil className="h-4 w-4" />
        </button>
      </Card>

      <Card className="flex items-center gap-3">
        <Mascot className="h-10 w-10 shrink-0" />
        <p className="rounded-2xl rounded-tl-sm bg-bg-elevated px-4 py-2 text-sm text-text-primary">
          Хороший темп! продолжай
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">{t("profile.contacts")}</h2>
        {isAdult ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Email: {me.email}</span>
            <button onClick={() => setPasswordOpen(true)} className="text-accent-green">
              Change
            </button>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Password: Not set</p>
        )}
      </Card>

      {!isAdult && me.parentLink && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-text-primary">{t("profile.parentAccount")}</h2>
          <p className="text-sm text-text-primary">
            {me.parentLink.guardianName}{" "}
            {me.parentLink.verifiedAt ? (
              <span className="text-accent-green">✓ {t("profile.verified")}</span>
            ) : (
              <span className="text-text-muted">— ожидает подтверждения</span>
            )}
          </p>
          <p className="text-xs text-text-muted">{me.parentLink.guardianEmail}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">{t("profile.skills")}</h2>
        <SkillsPentagon skills={me.skillProfile} />
      </Card>

      {isAdult && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-text-primary">{t("profile.accountDeletion")}</h2>
          <p className="mb-3 text-sm text-text-secondary">
            You can completely delete your Neuratop account
          </p>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash className="h-4 w-4" /> {t("common.delete")}
          </Button>
        </Card>
      )}

      <button
        onClick={() => clear()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-bg-secondary p-4 text-danger"
      >
        <LogOut className="h-4 w-4" /> {t("profile.logout")}
      </button>

      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} me={me} />
      <ChangePasswordModal open={passwordOpen} onOpenChange={setPasswordOpen} />
      <DeleteAccountModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          clear();
          navigate("/auth/login", { replace: true });
        }}
      />
    </div>
  );
}

function ChangePasswordModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const changePassword = useChangePassword();
  const [newPassword, setNewPassword] = useState("");

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Change password">
      <input
        type="password"
        placeholder="Новый пароль"
        className="w-full rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-2 text-text-primary focus:outline-none"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <Button
        className="mt-4 w-full"
        loading={changePassword.isPending}
        onClick={() => {
          changePassword.mutate(
            { newPassword },
            {
              onSuccess: () => {
                toast.success(t("common.saveChanges"));
                onOpenChange(false);
              },
              onError: () => toast.error(t("common.errorGeneric")),
            },
          );
        }}
      >
        {t("common.save")}
      </Button>
    </Modal>
  );
}

function DeleteAccountModal({
  open,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const deleteAccount = useDeleteAccount();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Удалить аккаунт?">
      <p className="mb-4 text-sm text-text-secondary">
        Это действие необратимо — все ваши данные будут удалены безвозвратно.
      </p>
      <Button
        variant="danger"
        className="w-full"
        loading={deleteAccount.isPending}
        onClick={() =>
          deleteAccount.mutate(undefined, {
            onSuccess: onDeleted,
            onError: () => toast.error("Не удалось удалить аккаунт"),
          })
        }
      >
        Удалить безвозвратно
      </Button>
    </Modal>
  );
}
