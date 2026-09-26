import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { settingsSchema, type SettingsDto, type SettingsInput } from '@inc/shared'
import type { z } from 'zod'
import { Field } from '@/components/field'
import { QueryState } from '@/components/query-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { applyServerErrors } from '@/lib/form-errors'
import { useSaveSettings, useSettings } from '../api'

type Out = z.output<typeof settingsSchema>
const card = 'flex flex-col gap-3.5 rounded-lg border border-hairline bg-background px-6 py-5'

function useSettingsForm(data: SettingsDto) {
  const save = useSaveSettings()
  const form = useForm<SettingsInput, unknown, Out>({ resolver: zodResolver(settingsSchema), defaultValues: data }) // `nextSeq` ikut di default tapi dibuang skema saat submit
  const onSubmit = form.handleSubmit(async (body) => {
    try {
      form.reset(await save.mutateAsync(body))
      toast('Pengaturan tersimpan.')
    } catch (e) {
      applyServerErrors(e, form.setError, [])
    }
  })
  return { form, onSubmit }
}

const SaveBar = ({ disabled }: { disabled: boolean }) => (
  <div>
    <Button type="submit" size="sm" disabled={disabled}>
      Simpan perubahan
    </Button>
  </div>
)

export function TaxNumberingTab() {
  const query = useSettings()
  return <QueryState query={query} rows={4}>{(data) => <TaxNumberingForm data={data} />}</QueryState>
}

function TaxNumberingForm({ data }: { data: SettingsDto }) {
  const { form, onSubmit } = useSettingsForm(data)
  const {
    register,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = form
  const terms = useFieldArray({ control, name: 'termsTemplates' })

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-[900px] flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-4">
        <section className={card}>
          <h2 className="text-base font-normal">Pajak</h2>
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2">
            <Field id="ppn" label="Tarif PPN (%)" error={errors.tax?.ppnRate?.message}>
              <Input id="ppn" inputMode="decimal" {...register('tax.ppnRate')} />
            </Field>
            <span className="pb-2.5 text-ink-mute">·</span>
            <Field id="dpp-num" label="DPP pembilang" error={errors.tax?.dppNum?.message}>
              <Input id="dpp-num" type="number" min={1} {...register('tax.dppNum')} />
            </Field>
            <span className="pb-2.5 text-ink-mute">/</span>
            <Field id="dpp-den" label="penyebut" error={errors.tax?.dppDen?.message}>
              <Input id="dpp-den" type="number" min={1} {...register('tax.dppDen')} />
            </Field>
          </div>
          <div className="rounded-md bg-canvas-soft p-3 font-mono text-xs leading-[1.7] text-ink-secondary">
            DPP = ROUND_HALF_UP(Subtotal × {data.tax.dppNum}/{data.tax.dppDen})
            <br />
            PPN = ROUND_HALF_UP(DPP × {data.tax.ppnRate}%)
            <br />
            Total = Subtotal + PPN
          </div>
          <span className="text-xs text-ink-mute">Perubahan tarif hanya berlaku untuk MO baru; MO lama menyimpan snapshot tarifnya.</span>
        </section>

        <section className={card}>
          <h2 className="text-base font-normal">Penomoran MO</h2>
          <Field id="tpl" label="Template" error={errors.numbering?.template?.message} helper="Token: {SEQ}, {SALES_CODE}, {MONTH_ROMAN}, {YEAR}">
            <Input id="tpl" className="font-mono text-sm" {...register('numbering.template')} />
          </Field>
          <div className="flex justify-between border-t border-hairline pt-2.5 text-sm">
            <span className="text-ink-mute">Reset urutan</span>
            <span>Setiap 1 Januari</span>
          </div>
          <div className="flex justify-between border-t border-hairline pt-2.5 text-sm">
            <span className="text-ink-mute">Urutan berikutnya ({data.nextSeq.year})</span>
            <span className="tnum">{String(data.nextSeq.seq).padStart(data.numbering.seqPad ?? 3, '0')}</span>
          </div>
        </section>
      </div>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-normal">Template Term &amp; Conditions</h2>
          <Button variant="ghost" size="sm" onClick={() => terms.append({ name: '', body: '' })}>
            + Tambah template
          </Button>
        </div>
        {terms.fields.length === 0 && <span className="text-sm text-ink-mute">Belum ada template.</span>}
        {terms.fields.map((f, i) => (
          <div key={f.id} className="flex flex-col gap-2 border-t border-hairline pt-3">
            <div className="flex items-end gap-2">
              <Field id={`tc-name-${i}`} label="Nama template" className="flex-1" error={errors.termsTemplates?.[i]?.name?.message}>
                <Input id={`tc-name-${i}`} {...register(`termsTemplates.${i}.name`)} />
              </Field>
              <Button variant="destructive" size="sm" className="pb-2.5" onClick={() => terms.remove(i)}>
                Hapus
              </Button>
            </div>
            <Field id={`tc-body-${i}`} label="Isi (maks. 10 baris di MO)" error={errors.termsTemplates?.[i]?.body?.message}>
              <Textarea id={`tc-body-${i}`} rows={4} {...register(`termsTemplates.${i}.body`)} />
            </Field>
          </div>
        ))}
      </section>
      <SaveBar disabled={isSubmitting || !isDirty} />
    </form>
  )
}

export function CompanyTab() {
  const query = useSettings()
  return <QueryState query={query} rows={5}>{(data) => <CompanyForm data={data} />}</QueryState>
}

function CompanyForm({ data }: { data: SettingsDto }) {
  const { form, onSubmit } = useSettingsForm(data)
  const {
    register,
    formState: { errors, isSubmitting, isDirty },
  } = form
  const e = errors.company

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-[560px] flex-col gap-4">
      <section className={card}>
        <Field id="co-name" label="Nama perusahaan" required error={e?.name?.message}>
          <Input id="co-name" {...register('company.name')} />
        </Field>
        <Field id="co-address" label="Alamat" required error={e?.address?.message}>
          <Textarea id="co-address" rows={3} {...register('company.address')} />
        </Field>
        <h2 className="border-t border-hairline pt-3 text-base font-normal">Rekening tujuan transfer (tampil di PDF)</h2>
        <Field id="co-bank" label="Bank" required error={e?.bankName?.message}>
          <Input id="co-bank" {...register('company.bankName')} />
        </Field>
        <Field id="co-acc" label="No. rekening" required error={e?.bankAccountNo?.message}>
          <Input id="co-acc" className="tnum" {...register('company.bankAccountNo')} />
        </Field>
        <Field id="co-accname" label="Atas nama" required error={e?.bankAccountName?.message}>
          <Input id="co-accname" {...register('company.bankAccountName')} />
        </Field>
      </section>
      <SaveBar disabled={isSubmitting || !isDirty} />
    </form>
  )
}
