/** Bancos chilenos — parsers Gmail (Balance) + referencia open-banking-chile / fintself. */
export const CHILE_BANKS = [
  {
    id: "bancochile",
    label: "Banco de Chile",
    keyword: "chile",
    emailSupported: true,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "bice",
    label: "BICE",
    keyword: "bice",
    emailSupported: true,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "bci",
    label: "BCI",
    keyword: "bci",
    emailSupported: true,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "mercadopago",
    label: "Mercado Pago",
    keyword: "mercado",
    emailSupported: true,
    fintech: true,
    products: ["debit"],
    debitProducts: ["wallet"],
  },
  {
    id: "tenpo",
    label: "Tenpo",
    keyword: "tenpo",
    emailSupported: true,
    fintech: true,
    products: ["debit"],
    debitProducts: ["wallet"],
  },
  {
    id: "bancoestado",
    label: "Banco Estado",
    keyword: "estado",
    emailSupported: true,
    debitProducts: ["cuentarut", "checking", "vista"],
  },
  {
    id: "santander",
    label: "Banco Santander",
    keyword: "santander",
    emailSupported: false,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "scotiabank",
    label: "Scotiabank",
    keyword: "scotiabank",
    emailSupported: false,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "itau",
    label: "Banco Itaú",
    keyword: "itau",
    emailSupported: false,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "bancosecurity",
    label: "Banco Security",
    keyword: "security",
    emailSupported: false,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "edwards",
    label: "Banco Edwards",
    keyword: "edwards",
    emailSupported: false,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "coopeuch",
    label: "Coopeuch",
    keyword: "coopeuch",
    emailSupported: false,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "consorcio",
    label: "Banco Consorcio",
    keyword: "consorcio",
    emailSupported: false,
    debitProducts: ["checking", "vista"],
  },
  {
    id: "falabella",
    label: "Banco Falabella",
    keyword: "falabella",
    emailSupported: true,
    retail: true,
    products: ["credit_card"],
  },
  {
    id: "cencosud",
    label: "Tarjeta Cencosud",
    keyword: "cencosud",
    emailSupported: false,
    retail: true,
    products: ["credit_card"],
  },
  {
    id: "ripley",
    label: "Ripley / Mastercard",
    keyword: "ripley",
    emailSupported: false,
    retail: true,
    products: ["credit_card"],
  },
] as const;

export type ChileBank = (typeof CHILE_BANKS)[number];
export type ChileBankId = ChileBank["id"];
export type AccountEntity = "personal" | "spa";
export type AccountProductSubtype = "debit" | "credit_card";
export type DebitProduct = "checking" | "vista" | "cuentarut" | "wallet";

export const DEBIT_PRODUCT_LABELS: Record<DebitProduct, string> = {
  checking: "Cuenta corriente",
  vista: "Cuenta vista",
  cuentarut: "CuentaRUT",
  wallet: "Cuenta / billetera",
};

export function getChileBank(id: ChileBankId): ChileBank {
  const bank = CHILE_BANKS.find((b) => b.id === id);
  if (!bank) throw new Error(`Banco desconocido: ${id}`);
  return bank;
}

export function getBankSubtypeOptions(bankId: ChileBankId): AccountProductSubtype[] {
  const bank = getChileBank(bankId);
  if ("products" in bank && bank.products) {
    return [...bank.products];
  }
  return ["debit", "credit_card"];
}

export function getBankDebitProducts(bankId: ChileBankId): DebitProduct[] {
  const bank = getChileBank(bankId);
  if ("debitProducts" in bank && bank.debitProducts) {
    return [...bank.debitProducts];
  }
  return ["checking"];
}

/** Qué pide el onboarding para matchear hints del parser Gmail. */
export type AccountIdentifierMode = "card_last4" | "account_number";

export function getAccountIdentifierMode(
  bankId: ChileBankId,
  subtype: AccountProductSubtype,
  debitProduct?: DebitProduct,
): AccountIdentifierMode {
  if (subtype === "credit_card") return "card_last4";
  // BE CuentaRUT / BCH CC: compras débito traen **** 1234; TEF matchea por suffix.
  if (bankId === "bancoestado" && debitProduct === "cuentarut") return "card_last4";
  if (
    bankId === "bancochile" &&
    (debitProduct === "checking" || debitProduct === "vista")
  ) {
    return "card_last4";
  }
  return "account_number";
}

export function getAccountIdentifierLabel(
  bankId: ChileBankId,
  subtype: AccountProductSubtype,
  debitProduct?: DebitProduct,
): string {
  const mode = getAccountIdentifierMode(bankId, subtype, debitProduct);
  if (subtype === "credit_card") return "Últimos 4 dígitos TC";
  if (mode === "card_last4") return "Últimos 4 dígitos tarjeta débito";
  return "Número de cuenta (solo dígitos)";
}

/** Convención Balance/promote: producto + banco; keyword en minúsculas en el nombre. */
export function buildAccountName(input: {
  bankId: ChileBankId;
  subtype: AccountProductSubtype;
  entity?: AccountEntity;
  debitProduct?: DebitProduct;
}): string {
  const bank = getChileBank(input.bankId);
  const entity = input.entity ?? "personal";

  if (input.subtype === "credit_card") {
    return `TC ${bank.label}`;
  }

  const debitProduct =
    input.debitProduct ?? getBankDebitProducts(input.bankId)[0];

  if (debitProduct === "wallet" || ("fintech" in bank && bank.fintech)) {
    return bank.label;
  }

  if (debitProduct === "cuentarut") {
    return entity === "spa" ? `CuentaRUT ${bank.label} SpA` : `CuentaRUT ${bank.label}`;
  }

  if (debitProduct === "vista") {
    return entity === "spa"
      ? `Cuenta Vista ${bank.label} SpA`
      : `Cuenta Vista ${bank.label}`;
  }

  if (entity === "spa" && input.bankId === "bci") {
    return `Cuenta ${bank.label} SpA`;
  }

  if (entity === "spa") {
    return `Cuenta Corriente ${bank.label} SpA`;
  }

  return `Cuenta Corriente ${bank.label}`;
}

export type AccountSetupInput = {
  bank_id: ChileBankId;
  subtype: AccountProductSubtype;
  entity?: AccountEntity;
  debit_product?: DebitProduct;
  card_last4?: string;
  card_currency?: "CLP" | "USD";
  account_number?: string;
};

export function validateAccountSetup(acc: AccountSetupInput): string | null {
  if (!acc.bank_id) return "Selecciona un banco";
  const bank = getChileBank(acc.bank_id);
  const allowedSubtypes = getBankSubtypeOptions(acc.bank_id);
  if (!allowedSubtypes.includes(acc.subtype)) {
    return `${bank.label} no usa ese tipo de producto`;
  }
  const debitProduct =
    acc.subtype === "debit"
      ? (acc.debit_product ?? getBankDebitProducts(acc.bank_id)[0])
      : undefined;
  const mode = getAccountIdentifierMode(acc.bank_id, acc.subtype, debitProduct);

  if (mode === "card_last4") {
    const last4 = acc.card_last4?.replace(/\D/g, "").slice(-4);
    if (!last4 || last4.length !== 4) {
      const product =
        acc.subtype === "credit_card"
          ? "de la TC"
          : "de la tarjeta débito";
      return `${bank.label}: ingresa los últimos 4 dígitos ${product}`;
    }
    return null;
  }

  const digits = acc.account_number?.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) {
    return `${bank.label}: ingresa el número de cuenta`;
  }
  return null;
}

export function accountSetupToPayload(acc: AccountSetupInput) {
  const debitProduct =
    acc.subtype === "debit"
      ? (acc.debit_product ?? getBankDebitProducts(acc.bank_id)[0])
      : undefined;
  const mode = getAccountIdentifierMode(acc.bank_id, acc.subtype, debitProduct);

  const name = buildAccountName({
    bankId: acc.bank_id,
    subtype: acc.subtype,
    entity: acc.entity,
    debitProduct,
  });

  return {
    name,
    subtype: acc.subtype,
    entity: acc.entity ?? ("personal" as const),
    card_last4: mode === "card_last4" ? acc.card_last4 : undefined,
    card_currency: acc.subtype === "credit_card" ? acc.card_currency : undefined,
    account_number: mode === "account_number" ? acc.account_number : undefined,
  };
}

export const CHILE_BANKS_WITH_EMAIL = CHILE_BANKS.filter((b) => b.emailSupported);
export const CHILE_BANKS_OTHER = CHILE_BANKS.filter((b) => !b.emailSupported);
