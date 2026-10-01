"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Headphones,
  LocateFixed,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  TicketCheck,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  consultTypes,
  fallbackCoordinates,
  type PlazaStore,
  type StoresResponse,
  type WaitSnapshot,
} from "@/lib/plaza-types";
import { clientConfig } from "@/lib/client-config";

type Props = {
  initialStores: PlazaStore[];
  initialError?: string;
};

type QueueResult = {
  queue_id?: string;
  customer_name?: string;
  consult_type_name?: string;
  queue_position?: number;
  expected_duration_min?: number;
  queue_status?: string;
  recalculated_wait?: WaitSnapshot;
};

type MapPosition = [number, number];

type NaverLatLng = object;
type NaverLatLngBounds = {
  extend(position: NaverLatLng): void;
};
type NaverMapInstance = {
  fitBounds(bounds: NaverLatLngBounds, margin?: number): void;
  setCenter(position: NaverLatLng): void;
  setZoom(zoom: number, useEffect?: boolean): void;
};
type NaverOverlay = {
  setMap(map: NaverMapInstance | null): void;
};
type NaverEventListener = object;
type NaverMapsApi = {
  Map: new (
    element: HTMLElement,
    options: {
      center: NaverLatLng;
      zoom: number;
      zoomControl: boolean;
      zoomControlOptions: { position: string };
    },
  ) => NaverMapInstance;
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  LatLngBounds: new () => NaverLatLngBounds;
  Marker: new (options: {
    map: NaverMapInstance;
    position: NaverLatLng;
    title?: string;
    icon: {
      content: string;
      size: object;
      anchor: object;
    };
    zIndex?: number;
  }) => NaverOverlay;
  Circle: new (options: {
    map: NaverMapInstance;
    center: NaverLatLng;
    radius: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    fillColor: string;
    fillOpacity: number;
  }) => NaverOverlay;
  Point: new (x: number, y: number) => object;
  Size: new (width: number, height: number) => object;
  Position: { BOTTOM_RIGHT: string };
  Event: {
    addListener(
      target: NaverOverlay,
      eventName: string,
      handler: () => void,
    ): NaverEventListener;
    removeListener(listener: NaverEventListener): void;
  };
};

declare global {
  interface Window {
    naver?: { maps: NaverMapsApi };
  }
}

const NAVER_MAP_CLIENT_ID = clientConfig.naverMapClientId;
const SITE_URL = clientConfig.siteUrl;
let naverMapsPromise: Promise<NaverMapsApi> | null = null;

function loadNaverMaps() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저에서만 지도를 불러올 수 있습니다."));
  }
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (naverMapsPromise) return naverMapsPromise;

  naverMapsPromise = new Promise<NaverMapsApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}`;
    script.async = true;
    script.dataset.naverMaps = "true";
    script.onload = () => {
      if (window.naver?.maps) resolve(window.naver.maps);
      else reject(new Error("네이버 지도 초기화에 실패했습니다."));
    };
    script.onerror = () => reject(new Error("네이버 지도를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  return naverMapsPromise;
}

function storePosition(store: PlazaStore): MapPosition | undefined {
  if (typeof store.latitude === "number" && typeof store.longitude === "number") {
    return [store.latitude, store.longitude];
  }
  return fallbackCoordinates[store.store_id];
}

function escapeMapText(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function naverDirectionsHref(store: PlazaStore, userPosition: MapPosition | null) {
  const destination = storePosition(store);
  if (!userPosition || !destination) {
    return `https://map.naver.com/p/search/${encodeURIComponent(store.address)}`;
  }

  const params = new URLSearchParams({
    slat: String(userPosition[0]),
    slng: String(userPosition[1]),
    sname: "현재 위치",
    dlat: String(destination[0]),
    dlng: String(destination[1]),
    dname: store.store_name,
    appname: SITE_URL,
  });
  return `nmap://route/public?${params.toString()}`;
}

function waitTone(wait?: WaitSnapshot | null) {
  const max = wait?.estimated_wait_max;
  if (typeof max !== "number") return "unknown";
  if (max <= 10) return "calm";
  if (max <= 25) return "normal";
  return "busy";
}

function waitLabel(wait?: WaitSnapshot | null) {
  const min = wait?.estimated_wait_min;
  const max = wait?.estimated_wait_max;
  if (typeof min !== "number" || typeof max !== "number") return "계산 전";
  if (min === 0 && max <= 5) return "바로 상담";
  return `${min}~${max}분`;
}

function formattedTime(value?: string) {
  if (!value) return "갱신 시각 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function MapCanvas({
  stores,
  selectedId,
  userPosition,
  onSelect,
}: {
  stores: PlazaStore[];
  selectedId?: string;
  userPosition: MapPosition | null;
  onSelect: (id: string) => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const mapsApiRef = useRef<NaverMapsApi | null>(null);
  const markerRefs = useRef<NaverOverlay[]>([]);
  const listenerRefs = useRef<NaverEventListener[]>([]);
  const userMarkerRef = useRef<NaverOverlay | null>(null);
  const userCircleRef = useRef<NaverOverlay | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!elementRef.current || mapRef.current) return;
      try {
        const maps = await loadNaverMaps();
        if (!active || !elementRef.current) return;

        const map = new maps.Map(elementRef.current, {
          center: new maps.LatLng(35.1796, 129.0756),
          zoom: 11,
          zoomControl: true,
          zoomControlOptions: { position: maps.Position.BOTTOM_RIGHT },
        });

        mapsApiRef.current = maps;
        mapRef.current = map;
        setMapReady(true);
      } catch (loadError) {
        if (!active) return;
        setMapError(
          loadError instanceof Error
            ? loadError.message
            : "네이버 지도를 불러오지 못했습니다.",
        );
      }
    }

    initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapsApiRef.current) return;

    const map = mapRef.current;
    const maps = mapsApiRef.current;
    try {
      for (const listener of listenerRefs.current) maps.Event.removeListener(listener);
      for (const marker of markerRefs.current) marker.setMap(null);
      listenerRefs.current = [];
      markerRefs.current = [];

      const bounds = new maps.LatLngBounds();
      let markerCount = 0;
      for (const store of stores) {
        const position = storePosition(store);
        if (!position) continue;

        const latLng = new maps.LatLng(position[0], position[1]);
        bounds.extend(latLng);
        markerCount += 1;
        const tone = waitTone(store.latest_wait);
        const selected = store.store_id === selectedId;
        const marker = new maps.Marker({
          map,
          position: latLng,
          title: store.store_name,
          zIndex: selected ? 20 : 10,
          icon: {
            content: `<button type="button" class="plaza-marker plaza-marker--${tone} ${
              selected ? "is-selected" : ""
            }" aria-label="${escapeMapText(store.store_name)}">${escapeMapText(
              waitLabel(store.latest_wait),
            )}</button>`,
            size: new maps.Size(76, 38),
            anchor: new maps.Point(38, 38),
          },
        });
        const listener = maps.Event.addListener(marker, "click", () => onSelect(store.store_id));
        markerRefs.current.push(marker);
        listenerRefs.current.push(listener);
      }

      if (markerCount > 0 && !selectedId) map.fitBounds(bounds, 70);
    } catch (markerError) {
      queueMicrotask(() => {
        setMapError(
          markerError instanceof Error
            ? markerError.message
            : "매장 위치를 지도에 표시하지 못했습니다.",
        );
      });
    }

    return () => {
      for (const listener of listenerRefs.current) maps.Event.removeListener(listener);
      for (const marker of markerRefs.current) marker.setMap(null);
      listenerRefs.current = [];
      markerRefs.current = [];
    };
  }, [mapReady, stores, selectedId, onSelect]);

  useEffect(() => {
    if (!selectedId || !mapReady || !mapRef.current || !mapsApiRef.current) return;
    const store = stores.find((item) => item.store_id === selectedId);
    if (!store) return;
    const position = storePosition(store);
    if (!position) return;
    mapRef.current.setCenter(new mapsApiRef.current.LatLng(position[0], position[1]));
    mapRef.current.setZoom(14, true);
  }, [mapReady, selectedId, stores]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapsApiRef.current || !userPosition) return;
    const map = mapRef.current;
    const maps = mapsApiRef.current;
    const position = new maps.LatLng(userPosition[0], userPosition[1]);

    userMarkerRef.current?.setMap(null);
    userCircleRef.current?.setMap(null);
    userCircleRef.current = new maps.Circle({
      map,
      center: position,
      radius: 90,
      strokeColor: "#1976d2",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#4da3ff",
      fillOpacity: 0.16,
    });
    userMarkerRef.current = new maps.Marker({
      map,
      position,
      title: "내 위치",
      zIndex: 100,
      icon: {
        content: '<span class="current-location-marker" aria-label="내 위치"></span>',
        size: new maps.Size(20, 20),
        anchor: new maps.Point(10, 10),
      },
    });
    map.setCenter(position);
    map.setZoom(15, true);
  }, [mapReady, userPosition]);

  useEffect(() => {
    return () => {
      const maps = mapsApiRef.current;
      if (maps) {
        for (const listener of listenerRefs.current) maps.Event.removeListener(listener);
      }
      for (const marker of markerRefs.current) marker.setMap(null);
      userMarkerRef.current?.setMap(null);
      userCircleRef.current?.setMap(null);
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="map-canvas-wrap">
      <div ref={elementRef} className="map-canvas" aria-label="KT 플라자 네이버 지도" />
      {mapError && (
        <div className="map-load-error" role="alert">
          <MapPin />
          <strong>지도를 표시하지 못했습니다</strong>
          <span>{mapError}</span>
        </div>
      )}
    </div>
  );
}

export function PlazaDashboard({ initialStores, initialError }: Props) {
  const [stores, setStores] = useState(initialStores);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("ALL");
  const [sort, setSort] = useState("WAIT");
  const [selectedId, setSelectedId] = useState(initialStores[0]?.store_id);
  const [consultType, setConsultType] = useState("COMMON");
  const [personalWait, setPersonalWait] = useState<WaitSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueCustomerId, setQueueCustomerId] = useState("");
  const [queueConsultType, setQueueConsultType] = useState("CT01");
  const [queueSubmitting, setQueueSubmitting] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [queueResult, setQueueResult] = useState<QueueResult | null>(null);
  const [userPosition, setUserPosition] = useState<MapPosition | null>(null);
  const [locating, setLocating] = useState(false);

  const districts = useMemo(
    () => [...new Set(stores.map((store) => store.district))].sort(),
    [stores],
  );

  const filteredStores = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const next = stores.filter((store) => {
      const matchesDistrict = district === "ALL" || store.district === district;
      const matchesQuery =
        !keyword ||
        store.store_name.toLowerCase().includes(keyword) ||
        store.address.toLowerCase().includes(keyword) ||
        store.district.toLowerCase().includes(keyword);
      return matchesDistrict && matchesQuery;
    });

    return [...next].sort((a, b) => {
      if (sort === "NAME") return a.store_name.localeCompare(b.store_name, "ko");
      return (
        (a.latest_wait?.estimated_wait_min ?? Number.MAX_SAFE_INTEGER) -
        (b.latest_wait?.estimated_wait_min ?? Number.MAX_SAFE_INTEGER)
      );
    });
  }, [stores, query, district, sort]);

  const selectedStore =
    stores.find((store) => store.store_id === selectedId) ?? filteredStores[0];
  const activeWait = personalWait ?? selectedStore?.latest_wait;

  const chooseStore = useCallback((id: string) => {
    setSelectedId(id);
    setConsultType("COMMON");
    setPersonalWait(null);
  }, []);

  function chooseConsultType(value: string) {
    setPersonalWait(null);
    setConsultType(value);
  }

  function locateUser() {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 현재 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
      },
      (locationError) => {
        const message =
          locationError.code === locationError.PERMISSION_DENIED
            ? "현재 위치 권한이 거부되었습니다. 브라우저에서 위치 권한을 허용해주세요."
            : "현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
        setError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function openQueueReception() {
    setQueueConsultType(consultType === "COMMON" ? "CT01" : consultType);
    setQueueCustomerId("");
    setQueueError("");
    setQueueResult(null);
    setQueueOpen(true);
  }

  function closeQueueReception() {
    if (queueSubmitting) return;
    setQueueOpen(false);
  }

  async function submitQueueReception(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStore) return;

    setQueueSubmitting(true);
    setQueueError("");
    try {
      const response = await fetch("/api/queue/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: selectedStore.store_id,
          customer_id: queueCustomerId,
          consult_type_id: queueConsultType,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: QueueResult;
      } & QueueResult;
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message ?? "대기 접수를 완료하지 못했습니다.");
      }
      setQueueResult((payload?.data ?? payload) as QueueResult);
      await refreshStores();
    } catch (requestError) {
      setQueueError(
        requestError instanceof Error
          ? requestError.message
          : "대기 접수를 완료하지 못했습니다.",
      );
    } finally {
      setQueueSubmitting(false);
    }
  }

  async function refreshStores() {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/stores", { cache: "no-store" });
      const payload = (await response.json()) as StoresResponse;
      if (!response.ok || !payload.ok) throw new Error("load failed");
      setStores(payload.stores);
      if (!payload.stores.some((store) => store.store_id === selectedId)) {
        setSelectedId(payload.stores[0]?.store_id);
      }
    } catch {
      setError("매장 현황을 새로 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!selectedStore || consultType === "COMMON") return;

    const controller = new AbortController();
    async function loadPersonalWait() {
      setCalculating(true);
      try {
        const params = new URLSearchParams({
          store_id: selectedStore.store_id,
          consult_type_id: consultType,
        });
        const response = await fetch(`/api/wait?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          data?: WaitSnapshot;
        };
        if (!response.ok || !payload.ok) throw new Error("calculate failed");
        setPersonalWait(payload.data ?? null);
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") {
          setError("선택한 업무의 맞춤 대기시간을 계산하지 못했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) setCalculating(false);
      }
    }

    loadPersonalWait();
    return () => controller.abort();
  }, [consultType, selectedStore]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">KT</span>
          <div>
            <p className="eyebrow">BUSAN PLAZA</p>
            <h1>플라자 대기현황</h1>
          </div>
        </div>
        <div className="live-block">
          <span className="live-dot" aria-hidden="true" />
          <div>
            <strong>실시간 현황</strong>
            <span>{formattedTime(stores[0]?.latest_wait?.calculated_at)} 기준</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="refresh-button"
            onClick={refreshStores}
            disabled={refreshing}
            aria-label="매장 현황 새로고침"
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="알림 닫기">닫기</button>
        </div>
      )}

      <section className="dashboard-grid">
        <aside className="store-panel">
          <div className="search-wrap">
            <Search aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="매장명, 지역, 주소 검색"
              aria-label="매장 검색"
            />
          </div>

          <div className="filter-row">
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="filter-select" aria-label="지역 선택">
                <SelectValue placeholder="지역 전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">지역 전체</SelectItem>
                {districts.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="filter-select" aria-label="정렬 방식 선택">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WAIT">대기 짧은 순</SelectItem>
                <SelectItem value="NAME">매장명 순</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="result-heading">
            <strong>{filteredStores.length}개 매장</strong>
            <span>대기시간은 실시간으로 달라질 수 있어요</span>
          </div>

          <div className="store-list" role="list">
            {filteredStores.map((store) => {
              const wait = store.latest_wait;
              const tone = waitTone(wait);
              const selected = store.store_id === selectedStore?.store_id;
              return (
                <button
                  key={store.store_id}
                  className={`store-card ${selected ? "is-selected" : ""}`}
                  onClick={() => chooseStore(store.store_id)}
                  role="listitem"
                >
                  <div className="store-card-top">
                    <div>
                      <span className="district-chip">{store.district}</span>
                      <h2>{store.store_name.replace("KT플라자 ", "")}</h2>
                    </div>
                    <div className={`wait-pill wait-pill--${tone}`}>
                      <span>예상 대기</span>
                      <strong>{waitLabel(wait)}</strong>
                    </div>
                  </div>
                  <p className="address-line"><MapPin />{store.address}</p>
                  <div className="store-metrics">
                    <span><Users />대기 {wait?.waiting_count ?? "-"}명</span>
                    <span><Headphones />상담 가능 {wait?.free_staff_now ?? "-"}명</span>
                  </div>
                </button>
              );
            })}
            {filteredStores.length === 0 && (
              <div className="empty-state">
                <Search />
                <strong>검색 결과가 없습니다</strong>
                <span>다른 매장명이나 지역을 입력해보세요.</span>
              </div>
            )}
          </div>
        </aside>

        <section className="map-panel">
          <MapCanvas
            stores={filteredStores}
            selectedId={selectedStore?.store_id}
            userPosition={userPosition}
            onSelect={chooseStore}
          />
          <Button
            type="button"
            variant="outline"
            className={`map-location-button ${userPosition ? "is-active" : ""}`}
            onClick={locateUser}
            disabled={locating}
          >
            <LocateFixed className={locating ? "animate-pulse" : ""} />
            {locating ? "위치 확인 중" : userPosition ? "내 위치 다시 찾기" : "내 위치"}
          </Button>
          <div className="map-legend" aria-label="대기시간 범례">
            <span><i className="legend-dot calm" />10분 이내</span>
            <span><i className="legend-dot normal" />25분 이내</span>
            <span><i className="legend-dot busy" />25분 초과</span>
          </div>

          {selectedStore && (
            <article className="detail-card">
              <div className="detail-heading">
                <div>
                  <span className="district-chip">{selectedStore.district}</span>
                  <h2>{selectedStore.store_name}</h2>
                  <p><MapPin />{selectedStore.address}</p>
                </div>
                <div className={`detail-wait wait-pill--${waitTone(activeWait)}`}>
                  <span>{consultType === "COMMON" ? "현재 예상 대기" : "업무별 예상 대기"}</span>
                  <strong>{calculating ? "계산 중" : waitLabel(activeWait)}</strong>
                </div>
              </div>

              <div className="consult-row">
                <label>방문 업무</label>
                <Select value={consultType} onValueChange={chooseConsultType}>
                  <SelectTrigger className="consult-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {consultTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="detail-metrics">
                <div><Users /><span>대기 고객</span><strong>{activeWait?.waiting_count ?? "-"}명</strong></div>
                <div><Headphones /><span>상담 가능</span><strong>{activeWait?.free_staff_now ?? "-"}명</strong></div>
                <div><Building2 /><span>근무 직원</span><strong>{activeWait?.working_staff_count ?? "-"}명</strong></div>
                <div><Clock3 /><span>최근 갱신</span><strong>{formattedTime(activeWait?.calculated_at)}</strong></div>
              </div>

              <div className="detail-footer">
                <a href={`tel:${selectedStore.phone}`}><Phone />{selectedStore.phone}</a>
                <span>평일 {selectedStore.weekday_open}–{selectedStore.weekday_close}</span>
                <Button className="queue-button" onClick={openQueueReception}>
                  <TicketCheck />대기 접수하기
                </Button>
                <a
                  href={naverDirectionsHref(selectedStore, userPosition)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <LocateFixed />{userPosition ? "대중교통 길찾기" : "길찾기"}
                </a>
              </div>
            </article>
          )}
        </section>
      </section>

      {queueOpen && selectedStore && (
        <div className="queue-modal-backdrop" role="presentation" onMouseDown={closeQueueReception}>
          <section
            className="queue-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="queue-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="queue-modal-close"
              onClick={closeQueueReception}
              aria-label="대기 접수 창 닫기"
            >
              <X />
            </button>

            {queueResult ? (
              <div className="queue-success">
                <CheckCircle2 aria-hidden="true" />
                <p className="queue-kicker">접수 완료</p>
                <h2>대기 접수가 완료되었습니다</h2>
                <p>{selectedStore.store_name}에서 순서가 되면 상담을 받을 수 있습니다.</p>

                <div className="queue-ticket">
                  <div>
                    <span>접수번호</span>
                    <strong>{queueResult.queue_id ?? "발급 완료"}</strong>
                  </div>
                  <div>
                    <span>현재 대기 순번</span>
                    <strong>
                      {typeof queueResult.queue_position === "number"
                        ? `${queueResult.queue_position}번`
                        : "확인 중"}
                    </strong>
                  </div>
                  <div>
                    <span>예상 대기시간</span>
                    <strong>{waitLabel(queueResult.recalculated_wait)}</strong>
                  </div>
                  <div>
                    <span>상담 업무</span>
                    <strong>
                      {queueResult.consult_type_name ??
                        consultTypes.find((type) => type.id === queueConsultType)?.name}
                    </strong>
                  </div>
                </div>

                <Button className="queue-complete-button" onClick={closeQueueReception}>
                  확인
                </Button>
              </div>
            ) : (
              <form onSubmit={submitQueueReception}>
                <p className="queue-kicker">현장 방문 대기</p>
                <h2 id="queue-modal-title">대기 접수하기</h2>
                <p className="queue-store-name">
                  <MapPin />{selectedStore.store_name}
                </p>

                <label className="queue-field">
                  <span>고객번호</span>
                  <Input
                    value={queueCustomerId}
                    onChange={(event) => setQueueCustomerId(event.target.value.toUpperCase())}
                    placeholder="예: CUS0102"
                    autoComplete="off"
                    maxLength={7}
                    required
                  />
                  <small>프로토타입 고객번호를 입력해주세요.</small>
                </label>

                <label className="queue-field">
                  <span>상담 업무</span>
                  <Select value={queueConsultType} onValueChange={setQueueConsultType}>
                    <SelectTrigger className="queue-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {consultTypes.filter((type) => type.id !== "COMMON").map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <div className="queue-preview">
                  <span>현재 예상 대기</span>
                  <strong>{waitLabel(activeWait)}</strong>
                  <small>접수 후 대기열 상황에 맞춰 다시 계산됩니다.</small>
                </div>

                {queueError && <p className="queue-form-error" role="alert">{queueError}</p>}

                <Button
                  type="submit"
                  className="queue-submit-button"
                  disabled={queueSubmitting || !queueCustomerId.trim()}
                >
                  {queueSubmitting ? <RefreshCw className="animate-spin" /> : <TicketCheck />}
                  {queueSubmitting ? "접수 처리 중" : "대기 접수 완료하기"}
                </Button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

