import { providerFlags } from "@/lib/config";
import { MockProvider, type MockFixture } from "@/lib/providers/mock/mock-provider";
import mockAFixture from "@/lib/providers/mock/fixtures/mock-a.json";
import mockBFixture from "@/lib/providers/mock/fixtures/mock-b.json";
import { NotImplementedProvider } from "@/lib/providers/stub-provider";
import type { PartProvider } from "@/lib/providers/types";

interface ProviderEntry {
  enabled: () => boolean;
  create: () => PartProvider;
}

/** 등록된 Provider 목록. 모든 Provider의 기본값은 비활성이며 feature flag로만 켠다. */
const entries: ProviderEntry[] = [
  {
    enabled: providerFlags.mock,
    create: () => new MockProvider("mock-a", "Mock 유통사 A", mockAFixture as MockFixture),
  },
  {
    enabled: providerFlags.mock,
    create: () => new MockProvider("mock-b", "Mock 유통사 B", mockBFixture as MockFixture),
  },
  {
    enabled: providerFlags.mouser,
    create: () => new NotImplementedProvider("mouser", "Mouser"),
  },
  {
    enabled: providerFlags.digikey,
    create: () => new NotImplementedProvider("digikey", "DigiKey"),
  },
];

/** 현재 플래그 기준으로 활성화된 Provider 목록. */
export function getEnabledProviders(): PartProvider[] {
  return entries.filter((e) => e.enabled()).map((e) => e.create());
}
