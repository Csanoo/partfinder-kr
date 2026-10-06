import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 부품 요청 첨부 파일 내려받기 (관리자 전용: proxy 의 Basic Auth 에 더해 여기서도 확인) */
export async function GET(request: Request, ctx: RouteContext<"/admin/inquiries/[id]/attachments/[attachmentId]">) {
  if (verifyAdmin(request.headers.get("authorization")) == null) return new Response("unauthorized", { status: 401 });
  const { id, attachmentId } = await ctx.params;
  if (!UUID_RE.test(id) || !UUID_RE.test(attachmentId)) return new Response("not found", { status: 404 });
  const a = await db().inquiryAttachment.findFirst({
    where: { id: attachmentId, inquiryId: id },
    select: { filename: true, contentType: true, data: true },
  });
  if (!a) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(a.data), {
    headers: {
      // 업로드된 파일을 브라우저에서 실행하지 않도록 항상 내려받기로 처리
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
