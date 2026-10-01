export type WaitSnapshot = {
  snapshot_id?: string;
  calculated_at?: string;
  consult_type_id?: string | null;
  working_staff_count?: number;
  active_consult_count?: number;
  free_staff_now?: number;
  waiting_count?: number;
  reservation_count_60m?: number;
  estimated_wait_point?: number;
  estimated_wait_min?: number;
  estimated_wait_max?: number;
  calculation_scope?: string;
};

export type PlazaStore = {
  store_id: string;
  store_name: string;
  district: string;
  address: string;
  phone: string;
  weekday_open: string;
  weekday_close: string;
  saturday_open: string;
  saturday_close: string;
  sunday_status: string;
  latitude: number | null;
  longitude: number | null;
  coordinate_status?: string;
  latest_wait: WaitSnapshot | null;
};

export type StoresResponse = {
  ok: boolean;
  count: number;
  stores: PlazaStore[];
};

export const fallbackCoordinates: Record<string, [number, number]> = {
  ST001: [35.0976993, 128.9198392],
  ST002: [35.2467481, 129.0892397],
  ST003: [35.2414467, 129.2131028],
  ST004: [35.3215518, 129.1749965],
  ST005: [35.1377346, 129.0623861],
  ST006: [35.2041884, 129.0830564],
  ST007: [35.2341585, 129.0108362],
  ST008: [35.2128703, 129.0195047],
  ST009: [35.1629712, 128.9846024],
  ST010: [35.0998133, 128.982118],
  ST011: [35.1124529, 129.0167105],
  ST012: [35.1926987, 129.0667488],
  ST013: [35.1739043, 129.0799381],
  ST014: [35.0991465, 129.0310139],
  ST015: [35.1095828, 129.0375871],
  ST016: [35.1552945, 129.0625099],
  ST017: [35.1630474, 129.1573707],
  ST018: [35.1697151, 129.1771811],
};

export const consultTypes = [
  { id: "COMMON", name: "전체 업무 평균" },
  { id: "CT01", name: "기기변경" },
  { id: "CT02", name: "요금제 변경" },
  { id: "CT03", name: "결합상품" },
  { id: "CT04", name: "USIM/eSIM" },
  { id: "CT05", name: "명의변경·법인업무" },
];

