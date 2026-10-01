/** CSV 템플릿 (엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 포함). 관리자 인증은 proxy에서 처리. */
export function GET() {
  const csv =
    "﻿mpn,manufacturer,category,package,lifecycle_status,eol_date,lifecycle_checked_at,lifecycle_source,datasheet_url\r\n" +
    "LM358-N/NOPB,Texas Instruments,증폭기,SOIC-8,active,,2026-10-01,제조사 상품 페이지,https://www.ti.com/lit/ds/symlink/lm158-n.pdf\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="parts-template.csv"',
    },
  });
}
