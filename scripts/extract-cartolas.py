#!/usr/bin/env python3
"""Extract Banco Chile XLS, BancoEstado PDF, Falabella PDF, liquidaciones → JSON."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARTOLAS = ROOT / "data" / "cartolas"
OUT = CARTOLAS / "_extracted.json"

MONTHS = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}
MONTH_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


def parse_clp(raw: str | float | int | None) -> int:
    if raw is None or raw == "":
        return 0
    if isinstance(raw, (int, float)):
        return int(round(float(raw)))
    s = str(raw).strip().replace("$", "").replace(".", "").replace(" ", "")
    s = s.replace(",", "")
    if not s or s == "-":
        return 0
    return int(s)


def be_date_to_iso(token: str, year: int) -> str | None:
    m = re.match(r"(\d{2})/([A-Za-z]{3})\.?", token.strip())
    if not m:
        return None
    day = int(m.group(1))
    mon = MONTHS.get(m.group(2).lower()[:3])
    if not mon:
        return None
    return f"{year:04d}-{mon:02d}-{day:02d}"


def extract_banco_chile() -> list[dict]:
    import xlrd

    docs = []
    for path in sorted((CARTOLAS / "banco_chile").glob("*.xls")):
        wb = xlrd.open_workbook(str(path))
        sheet = wb.sheet_by_index(0)
        owner = None
        rut = None
        account = None
        issued = None
        for r in range(min(20, sheet.nrows)):
            label = str(sheet.cell(r, 1).value).strip().lower()
            val = str(sheet.cell(r, 2).value).strip()
            if "sr" in label and owner is None and val:
                owner = val
            if label.startswith("rut"):
                rut = val
            if label.startswith("cuenta"):
                account = re.sub(r"\D", "", val)
            if "emisión" in str(sheet.cell(r, 3).value).lower() or "emision" in str(sheet.cell(r, 3).value).lower():
                issued = str(sheet.cell(r, 4).value).strip()

        # Year from emission date dd/mm/yyyy
        year = 2026
        if issued and re.match(r"\d{2}/\d{2}/\d{4}", issued):
            year = int(issued.split("/")[2])

        header = None
        for r in range(sheet.nrows):
            if str(sheet.cell(r, 1).value).strip() == "Fecha":
                header = r
                break
        if header is None:
            continue

        lines = []
        opening = None
        closing = None
        for r in range(header + 1, sheet.nrows):
            fecha = str(sheet.cell(r, 1).value).strip()
            desc = str(sheet.cell(r, 2).value).strip()
            if not desc:
                continue
            cargo = parse_clp(sheet.cell(r, 4).value)
            abono = parse_clp(sheet.cell(r, 5).value)
            saldo = parse_clp(sheet.cell(r, 6).value) if sheet.cell(r, 6).value != "" else None
            if "SALDO INICIAL" in desc.upper():
                opening = saldo
                continue
            if "SALDO FINAL" in desc.upper():
                closing = saldo
                continue
            if not fecha or "/" not in fecha:
                continue
            day, month = fecha.split("/")
            # Year boundary: Dec rows in Jan cartola use previous year
            y = year
            if int(month) == 12 and year and "1231" not in path.name and "3012" in path.name:
                y = year  # filename year is emission year
            # Infer from filename cartola_DDMMYYYY
            fm = re.search(r"cartola_(\d{2})(\d{2})(\d{4})", path.name)
            if fm:
                emit_y = int(fm.group(3))
                emit_m = int(fm.group(2))
                y = emit_y
                if int(month) > emit_m:
                    y = emit_y - 1
            iso = f"{y:04d}-{int(month):02d}-{int(day):02d}"
            lines.append({
                "doc": f"bch-{path.stem}-{r}",
                "date": iso,
                "description": desc,
                "charge": cargo,
                "deposit": abono,
                "balance": saldo,
            })

        docs.append({
            "bank": "banco_chile",
            "file": path.name,
            "account_number": account.lstrip("0") if account else None,
            "owner": owner,
            "rut": rut,
            "opening_balance": opening,
            "closing_balance": closing,
            "lines": lines,
        })
    return docs


def extract_banco_estado() -> list[dict]:
    docs = []
    for path in sorted((CARTOLAS / "banco_estado").glob("*.pdf")):
        text = subprocess.check_output(
            ["pdftotext", "-layout", "-opw", "2300", str(path), "-"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        cartola_no = re.search(r"Cartola Seleccionada\s+(\d+)", text)
        emit = re.search(r"Fecha Emisión\s+(\d{2}/\d{2}/\d{4})", text)
        year = int(emit.group(1).split("/")[2]) if emit else 2026
        # Skip pre-2026 historical cartolas mixed into the dump (e.g. 000015 = Nov 2025)
        period_end = re.search(r"Fecha Final\s+(\d{2}/\d{2}/\d{4})", text)
        if period_end:
            pe = period_end.group(1)
            pe_iso = f"{pe.split('/')[2]}-{pe.split('/')[1]}-{pe.split('/')[0]}"
            if pe_iso < "2026-01-01":
                continue
        opening = parse_clp(re.search(r"Saldo Anterior\s*\$\s*([\d.]+)", text).group(1)) if re.search(r"Saldo Anterior\s*\$\s*([\d.]+)", text) else None
        closing = parse_clp(re.search(r"Saldo Final\s*\$\s*([\d.]+)", text).group(1)) if re.search(r"Saldo Final\s*\$\s*([\d.]+)", text) else None

        # Merge wrapped description lines into single rows
        raw_lines = text.splitlines()
        rows = []
        i = 0
        while i < len(raw_lines):
            line = raw_lines[i]
            m = re.match(
                r"^\s*(\d{2}/[A-Za-z]{3}\.?)\s+(\d{5,8})\s+(.+)$",
                line,
            )
            if not m:
                i += 1
                continue
            date_tok, doc, rest = m.group(1), m.group(2), m.group(3).strip()
            amounts = re.findall(r"\$\s*([\d.]+)", rest)
            desc = re.split(r"\$", rest, maxsplit=1)[0].strip()
            # Name/description wraps onto following indented lines (no $ amounts)
            j = i + 1
            while j < len(raw_lines):
                nxt = raw_lines[j]
                if re.match(r"^\s*\d{2}/[A-Za-z]{3}", nxt) or re.match(r"^\s*Fecha\s", nxt):
                    break
                if nxt.strip().startswith("Cartola") or "Detalle de Movimientos" in nxt:
                    break
                frag = nxt.strip()
                if frag and not re.search(r"\$\s*[\d.]+", frag) and len(frag) < 40:
                    desc += " " + frag
                elif frag and re.search(r"\$\s*[\d.]+", frag):
                    break
                j += 1
            desc = re.sub(r"\s+", " ", desc).strip()
            deposit, charge = 0, 0
            balance = None
            if len(amounts) == 1:
                # Could be charge or deposit — look at column position heuristically
                # If "TEF DE" / abono words → deposit; else charge
                amt = parse_clp(amounts[0])
                if re.match(r"^TEF DE\b|^ABONO\b", desc, re.I):
                    deposit = amt
                else:
                    charge = amt
            elif len(amounts) >= 2:
                # abono, cargo, saldo OR cargo, saldo
                # Layout: Abonos | Cargos | Saldo
                # TEF DE lines: abono + saldo (2 amounts)
                # PAGO lines: cargo + saldo (2 amounts)
                if re.match(r"^TEF DE\b|^ABONO\b", desc, re.I):
                    deposit = parse_clp(amounts[0])
                    balance = parse_clp(amounts[-1])
                elif len(amounts) == 3:
                    deposit = parse_clp(amounts[0])
                    charge = parse_clp(amounts[1])
                    balance = parse_clp(amounts[2])
                else:
                    charge = parse_clp(amounts[0])
                    balance = parse_clp(amounts[-1])

            iso = be_date_to_iso(date_tok, year)
            if iso and (deposit > 0 or charge > 0):
                rows.append({
                    "doc": doc,
                    "date": iso,
                    "description": desc,
                    "charge": charge,
                    "deposit": deposit,
                    "balance": balance,
                })
            i = j if j > i else i + 1

        docs.append({
            "bank": "banco_estado",
            "file": path.name,
            "cartola_no": cartola_no.group(1) if cartola_no else None,
            "account_number": "18202300",
            "opening_balance": opening,
            "closing_balance": closing,
            "lines": rows,
        })
    return docs


def extract_falabella() -> list[dict]:
    docs = []
    for path in sorted((CARTOLAS / "banco_falabella").glob("*.pdf")):
        text = subprocess.check_output(
            ["pdftotext", "-layout", str(path), "-"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        billing = re.search(r"Fecha Facturación Estado de Cuenta:\s+(\d{2}/\d{2}/\d{4})", text)
        total = re.search(r"Monto Total Facturado a Pagar\s+\$?([\d.]+)", text)
        minimum = re.search(r"Monto mínimo a pagar\s+\$?([\d.]+)", text, re.I)
        # Cupo Total* / Cupo Utilizado / Cupo Disponible (first data row)
        cupo_m = re.search(
            r"Cupo Total\*\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
            text,
        )
        cupo_total = parse_clp(cupo_m.group(1)) if cupo_m else None
        cupo_utilizado = parse_clp(cupo_m.group(2)) if cupo_m else None
        cupo_disponible = parse_clp(cupo_m.group(3)) if cupo_m else None
        payments = []
        for m in re.finditer(
            r"(\d{2}/\d{2}/\d{4})\s+Pago tarjeta cmr\s+T\s+(-?[\d.]+)",
            text,
            re.I,
        ):
            day, month, year = m.group(1).split("/")
            amt = abs(parse_clp(m.group(2)))
            if amt <= 1:
                continue
            payments.append({
                "date": f"{year}-{month}-{day}",
                "amount": amt,
                "description": "Pago tarjeta CMR",
            })

        purchases = []
        for m in re.finditer(
            r"([A-Za-zÁÉÍÓÚÑáéíóúñ .]+?)\s+(\d{2}/\d{2}/\d{4})\s+(.+?)\s+T\s+([\d.]+)\s+([\d.]+)",
            text,
        ):
            day, month, year = m.group(2).split("/")
            merchant = m.group(3).strip()
            if re.search(r"Pago tarjeta|Impuesto|Servicio admin|seg desgravamen", merchant, re.I):
                continue
            amount = parse_clp(m.group(4))
            if amount <= 0:
                continue
            purchases.append({
                "date": f"{year}-{month}-{day}",
                "description": f"CMR {merchant}",
                "charge": amount,
                "deposit": 0,
                "doc": f"cmr-{path.stem}-{m.start()}",
            })

        docs.append({
            "bank": "banco_falabella",
            "file": path.name,
            "billing_date": (
                f"{billing.group(1).split('/')[2]}-{billing.group(1).split('/')[1]}-{billing.group(1).split('/')[0]}"
                if billing else None
            ),
            "total_due": parse_clp(total.group(1)) if total else None,
            "minimum_due": parse_clp(minimum.group(1)) if minimum else None,
            "cupo_total": cupo_total,
            "cupo_utilizado": cupo_utilizado,
            "cupo_disponible": cupo_disponible,
            "payments": payments,
            "purchases": purchases,
        })
    return docs


def extract_liquidaciones() -> list[dict]:
    docs = []
    for path in sorted((CARTOLAS / "liquidaciones").glob("*.pdf")):
        text = subprocess.check_output(
            ["pdftotext", "-layout", str(path), "-"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        mes = re.search(r"MES:\s+([A-ZÁÉÍÓÚ]+)\s+DE\s+(\d{4})", text, re.I)
        liquido = re.search(r"ALCANCE LIQUIDO\s*\*\*\s*\$\s*([\d.]+)", text)
        empresa = re.search(r"EMPRESA\s*:\s+(.+)", text)
        if not mes or not liquido:
            continue
        month = MONTH_ES[mes.group(1).lower()]
        year = int(mes.group(2))
        docs.append({
            "bank": "liquidacion",
            "file": path.name,
            "period": f"{year:04d}-{month:02d}",
            "employer": empresa.group(1).strip() if empresa else None,
            "net_pay": parse_clp(liquido.group(1)),
        })
    return docs


def main() -> int:
    payload = {
        "banco_chile": extract_banco_chile(),
        "banco_estado": extract_banco_estado(),
        "banco_falabella": extract_falabella(),
        "liquidaciones": extract_liquidaciones(),
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    bch_n = sum(len(d["lines"]) for d in payload["banco_chile"])
    be_n = sum(len(d["lines"]) for d in payload["banco_estado"])
    print(f"Wrote {OUT}")
    print(f"  BCH docs={len(payload['banco_chile'])} lines={bch_n}")
    print(f"  BE  docs={len(payload['banco_estado'])} lines={be_n}")
    print(f"  Falabella docs={len(payload['banco_falabella'])}")
    print(f"  Liquidaciones={len(payload['liquidaciones'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
