import { Phone, MapPin } from "lucide-react";
import { ageText, fmtDate } from "@/lib/format";

export type EmergencyData = {
  name: string;
  breed: string | null;
  birth_date: string | null;
  sex: "female" | "male" | null;
  neutered: boolean | null;
  chip_number: string | null;
  license_number: string | null;
  allergies: string | null;
  conditions: string | null;
  medications: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  vet_address: string | null;
  owners?: { name: string | null }[] | null;
  vaccinations?: { type: string; given_on: string; next_due: string | null }[] | null;
};

function Item({ label, value, alert }: { label: string; value: string | null | undefined; alert?: boolean }) {
  if (!value) return null;
  return (
    <div className={alert ? "rounded-xl bg-red-50 p-3" : "py-1"}>
      <div className={alert ? "text-xs font-semibold text-red-700" : "text-xs text-muted"}>{label}</div>
      <div className="whitespace-pre-wrap font-medium">{value}</div>
    </div>
  );
}

/** The critical info, shared by the in-app screen and the public link. */
export function EmergencyCard({ d, photo }: { d: EmergencyData; photo?: React.ReactNode }) {
  const sex = d.sex === "female" ? "נקבה" : d.sex === "male" ? "זכר" : null;
  const neutered = d.neutered === null ? null : d.neutered ? "מעוקר/ת" : "לא מעוקר/ת";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {photo}
        <div>
          <div className="text-2xl font-bold">{d.name}</div>
          <div className="text-muted">{[d.breed, sex, neutered, ageText(d.birth_date)].filter(Boolean).join(" · ")}</div>
        </div>
      </div>

      <div className="space-y-2">
        <Item label="⚠️ אלרגיות" value={d.allergies} alert />
        <Item label="⚠️ מחלות כרוניות" value={d.conditions} alert />
        <Item label="💊 תרופות קבועות" value={d.medications} alert />
      </div>

      {(d.vet_name || d.vet_phone) && (
        <div className="rounded-2xl bg-brand/5 p-4">
          <div className="text-xs text-muted">וטרינר קבוע</div>
          <div className="text-lg font-bold">{d.vet_name}</div>
          {d.vet_address && (
            <div className="flex items-center gap-1 text-sm text-muted">
              <MapPin size={14} />
              {d.vet_address}
            </div>
          )}
          {d.vet_phone && (
            <a href={`tel:${d.vet_phone}`} className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-white">
              <Phone size={20} />
              חיוג לווטרינר <span dir="ltr">{d.vet_phone}</span>
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4">
        <Item label="מספר שבב" value={d.chip_number} />
        <Item label="רישיון עירוני" value={d.license_number} />
      </div>

      {d.vaccinations && d.vaccinations.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted">חיסונים אחרונים</div>
          {d.vaccinations.map((v) => (
            <div key={v.type} className="flex justify-between border-b border-line py-1.5 text-sm last:border-0">
              <span>{v.type}</span>
              <span className="text-muted">{fmtDate(v.given_on)}</span>
            </div>
          ))}
        </div>
      )}

      {d.owners && d.owners.some((o) => o.name) && (
        <Item label="בעלים" value={d.owners.map((o) => o.name).filter(Boolean).join(", ")} />
      )}
    </div>
  );
}
