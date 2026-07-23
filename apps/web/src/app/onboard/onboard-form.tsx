"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CHILE_BANKS_OTHER,
  CHILE_BANKS_WITH_EMAIL,
  DEBIT_PRODUCT_LABELS,
  type AccountEntity,
  type AccountProductSubtype,
  type ChileBankId,
  type DebitProduct,
  accountSetupToPayload,
  buildAccountName,
  getAccountIdentifierLabel,
  getAccountIdentifierMode,
  getBankDebitProducts,
  getBankSubtypeOptions,
  getChileBank,
  validateAccountSetup,
} from "@/lib/chile-banks";

type AccountForm = {
  bank_id: ChileBankId;
  subtype: AccountProductSubtype;
  debit_product: DebitProduct;
  entity: AccountEntity;
  card_last4: string;
  card_currency: "CLP" | "USD";
  account_number: string;
};

function defaultForm(bankId: ChileBankId = "bancochile"): AccountForm {
  const subtypes = getBankSubtypeOptions(bankId);
  const subtype = subtypes[0];
  return {
    bank_id: bankId,
    subtype,
    debit_product: getBankDebitProducts(bankId)[0],
    entity: "personal",
    card_last4: "",
    card_currency: "CLP",
    account_number: "",
  };
}

const PRESETS: AccountForm[] = [
  defaultForm("bancochile"),
  { ...defaultForm("bancochile"), subtype: "credit_card" },
];

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const labelClass = "text-xs font-medium text-zinc-500 dark:text-zinc-400";

function normalizeBankChange(current: AccountForm, bankId: ChileBankId): AccountForm {
  const subtypes = getBankSubtypeOptions(bankId);
  const subtype = subtypes.includes(current.subtype) ? current.subtype : subtypes[0];
  const debitProducts = getBankDebitProducts(bankId);
  const debit_product = debitProducts.includes(current.debit_product)
    ? current.debit_product
    : debitProducts[0];

  return {
    ...current,
    bank_id: bankId,
    subtype,
    debit_product,
  };
}

export default function OnboardForm() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountForm[]>(PRESETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAccount(index: number, patch: Partial<AccountForm>) {
    setAccounts((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        const next = { ...a, ...patch };
        if (patch.bank_id) return normalizeBankChange(next, patch.bank_id);
        if (patch.subtype === "credit_card") return next;
        if (patch.subtype === "debit") {
          return {
            ...next,
            debit_product: getBankDebitProducts(next.bank_id)[0],
          };
        }
        return next;
      }),
    );
  }

  function addAccount() {
    setAccounts((prev) => [...prev, defaultForm()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const setups = accounts
      .map((a) => ({
        bank_id: a.bank_id,
        subtype: a.subtype,
        entity: a.entity,
        debit_product: a.debit_product,
        card_last4: a.card_last4,
        card_currency: a.card_currency,
        account_number: a.account_number,
      }))
      .filter((a) => {
        const mode = getAccountIdentifierMode(
          a.bank_id,
          a.subtype,
          a.debit_product,
        );
        if (mode === "card_last4") {
          return a.card_last4.replace(/\D/g, "").length >= 4;
        }
        return a.account_number.replace(/\D/g, "").length > 0;
      });

    if (setups.length === 0) {
      setError(
        "Completa al menos una cuenta con número de cuenta o últimos 4 dígitos.",
      );
      setLoading(false);
      return;
    }

    for (const setup of setups) {
      const validationError = validateAccountSetup(setup);
      if (validationError) {
        setError(validationError);
        setLoading(false);
        return;
      }
    }

    const payload = setups.map(accountSetupToPayload);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts: payload }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }

    router.push("/settings");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Configura tus cuentas</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Elige banco y producto por separado. Los marcados con sync Gmail ya
          tienen parser de correos; el resto queda listo para cartolas o futuros
          parsers.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {accounts.map((acc, i) => {
          const bank = getChileBank(acc.bank_id);
          const subtypeOptions = getBankSubtypeOptions(acc.bank_id);
          const debitProducts = getBankDebitProducts(acc.bank_id);
          const previewName = buildAccountName({
            bankId: acc.bank_id,
            subtype: acc.subtype,
            entity: acc.entity,
            debitProduct: acc.debit_product,
          });
          const identifierMode = getAccountIdentifierMode(
            acc.bank_id,
            acc.subtype,
            acc.debit_product,
          );
          const identifierLabel = getAccountIdentifierLabel(
            acc.bank_id,
            acc.subtype,
            acc.debit_product,
          );

          return (
            <fieldset
              key={i}
              className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <legend className="px-1 text-sm font-medium">Cuenta {i + 1}</legend>

              <div className="space-y-1">
                <label className={labelClass} htmlFor={`bank-${i}`}>
                  Banco
                </label>
                <select
                  id={`bank-${i}`}
                  value={acc.bank_id}
                  onChange={(e) =>
                    updateAccount(i, { bank_id: e.target.value as ChileBankId })
                  }
                  className={inputClass}
                >
                  <optgroup label="Sync Gmail (correos)">
                    {CHILE_BANKS_WITH_EMAIL.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Otros bancos (cartola / manual)">
                    {CHILE_BANKS_OTHER.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {!bank.emailSupported && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Sin parser Gmail aún — útil para cartolas y conciliación.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelClass} htmlFor={`subtype-${i}`}>
                    Tipo de producto
                  </label>
                  <select
                    id={`subtype-${i}`}
                    value={acc.subtype}
                    onChange={(e) =>
                      updateAccount(i, {
                        subtype: e.target.value as AccountProductSubtype,
                      })
                    }
                    className={inputClass}
                  >
                    {subtypeOptions.includes("debit") && (
                      <option value="debit">Cuenta / débito</option>
                    )}
                    {subtypeOptions.includes("credit_card") && (
                      <option value="credit_card">Tarjeta de crédito</option>
                    )}
                  </select>
                </div>

                {acc.subtype === "debit" && debitProducts.length > 1 ? (
                  <div className="space-y-1">
                    <label className={labelClass} htmlFor={`debit-product-${i}`}>
                      Tipo de cuenta
                    </label>
                    <select
                      id={`debit-product-${i}`}
                      value={acc.debit_product}
                      onChange={(e) =>
                        updateAccount(i, {
                          debit_product: e.target.value as DebitProduct,
                        })
                      }
                      className={inputClass}
                    >
                      {debitProducts.map((p) => (
                        <option key={p} value={p}>
                          {DEBIT_PRODUCT_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className={labelClass} htmlFor={`entity-${i}`}>
                      Titular
                    </label>
                    <select
                      id={`entity-${i}`}
                      value={acc.entity}
                      onChange={(e) =>
                        updateAccount(i, {
                          entity: e.target.value as AccountEntity,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="personal">Personal</option>
                      <option value="spa">SpA / empresa</option>
                    </select>
                  </div>
                )}
              </div>

              {acc.subtype === "debit" && debitProducts.length > 1 && (
                <div className="space-y-1">
                  <label className={labelClass} htmlFor={`entity-${i}`}>
                    Titular
                  </label>
                  <select
                    id={`entity-${i}`}
                    value={acc.entity}
                    onChange={(e) =>
                      updateAccount(i, {
                        entity: e.target.value as AccountEntity,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="personal">Personal</option>
                    <option value="spa">SpA / empresa</option>
                  </select>
                </div>
              )}

              {acc.subtype === "credit_card" && (
                <div className="space-y-1">
                  <label className={labelClass} htmlFor={`entity-cc-${i}`}>
                    Titular
                  </label>
                  <select
                    id={`entity-cc-${i}`}
                    value={acc.entity}
                    onChange={(e) =>
                      updateAccount(i, {
                        entity: e.target.value as AccountEntity,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="personal">Personal</option>
                    <option value="spa">SpA / empresa</option>
                  </select>
                </div>
              )}

              {acc.subtype === "credit_card" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className={labelClass} htmlFor={`last4-${i}`}>
                      {identifierLabel}
                    </label>
                    <input
                      id={`last4-${i}`}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1234"
                      value={acc.card_last4}
                      onChange={(e) =>
                        updateAccount(i, { card_last4: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass} htmlFor={`currency-${i}`}>
                      Moneda TC
                    </label>
                    <select
                      id={`currency-${i}`}
                      value={acc.card_currency}
                      onChange={(e) =>
                        updateAccount(i, {
                          card_currency: e.target.value as "CLP" | "USD",
                        })
                      }
                      className={inputClass}
                    >
                      <option value="CLP">CLP</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              ) : identifierMode === "card_last4" ? (
                <div className="space-y-1">
                  <label className={labelClass} htmlFor={`last4-${i}`}>
                    {identifierLabel}
                  </label>
                  <input
                    id={`last4-${i}`}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1958"
                    value={acc.card_last4}
                    onChange={(e) =>
                      updateAccount(i, { card_last4: e.target.value })
                    }
                    className={inputClass}
                  />
                  <p className="text-xs text-zinc-500">
                    Aparece en el correo como{" "}
                    <span className="font-mono">**** 1958</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className={labelClass} htmlFor={`account-${i}`}>
                    {identifierLabel}
                  </label>
                  <input
                    id={`account-${i}`}
                    inputMode="numeric"
                    placeholder="1122334455"
                    value={acc.account_number}
                    onChange={(e) =>
                      updateAccount(i, { account_number: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              )}

              <p className="text-xs text-zinc-500">
                Se guardará como:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {previewName}
                </span>
              </p>
            </fieldset>
          );
        })}

        <button
          type="button"
          onClick={addAccount}
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          + Agregar otra cuenta / banco
        </button>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Guardando…" : "Continuar → conectar Gmail"}
        </button>
      </form>
    </div>
  );
}
