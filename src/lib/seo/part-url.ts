import { site } from "@/lib/site";

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}
