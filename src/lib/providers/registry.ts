import { providerFlags } from "@/lib/config";
import { MockProvider, type MockFixture } from "@/lib/providers/mock/mock-provider";
import mockAFixture from "@/lib/providers/mock/fixtures/mock-a.json";
import mockBFixture from "@/lib/providers/mock/fixtures/mock-b.json";
import mockBrokerFixture from "@/lib/providers/mock/fixtures/mock-broker.json";
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
    enabled: providerFlags.mock,
    create: () => new MockProvider("mock-broker", "Mock 브로커", mockBrokerFixture as MockFixture, "broker"),
  },
  {
    enabled: providerFlags.mouser,
    create: () => new NotImplementedProvider("mouser", "Mouser", "authorized"),
  },
  {
    enabled: providerFlags.digikey,
    create: () => new NotImplementedProvider("digikey", "DigiKey", "authorized"),
  },
  // TODO(확인필요): 아래 소스의 broker 분류. 저장된 HTML fixture로 파서 구현 후 교체
  {
    enabled: providerFlags.heisener,
    create: () => new NotImplementedProvider("heisener", "Heisener", "broker"),
  },
  {
    enabled: providerFlags.censtry,
    create: () => new NotImplementedProvider("censtry", "Censtry", "broker"),
  },
  {
    enabled: providerFlags.worldway,
    create: () => new NotImplementedProvider("worldway", "Worldway Electronics", "broker"),
  },
  {
    enabled: providerFlags.hkinventory,
    create: () => new NotImplementedProvider("hkinventory", "HKinventory", "broker"),
  },
];

/** 현재 플래그 기준으로 활성화된 Provider 목록. */
export function getEnabledProviders(): PartProvider[] {
  return entries.filter((e) => e.enabled()).map((e) => e.create());
}
