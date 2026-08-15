import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { ApiError } from "@/api/client";
import { useUpdateProfile, type Me } from "@/features/profile/hooks";

export function EditProfileModal({
  open,
  onOpenChange,
  me,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  me: Me;
}) {
  const { t } = useTranslation();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(me.nickname);
  const [age, setAge] = useState(me.age);
  const [consentError, setConsentError] = useState<string | null>(null);

  async function handleSave() {
    setConsentError(null);
    try {
      await updateProfile.mutateAsync({ name, age });
      onOpenChange(false);
      toast.success(t("common.saveChanges"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConsentError("Для смены возраста в эту категорию требуется подтверждение родителя/опекуна");
        return;
      }
      toast.error(err instanceof ApiError ? err.message : t("common.errorGeneric"));
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("profile.editProfile")}>
      <div className="space-y-4">
        <Input label={t("profile.username")} value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label={t("profile.age")}
          type="number"
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
        />
        {consentError && <p className="text-sm text-danger">{consentError}</p>}
        <Button className="w-full" loading={updateProfile.isPending} onClick={() => void handleSave()}>
          {t("common.saveChanges")}
        </Button>
      </div>
    </Modal>
  );
}
