import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../apiClient';
import { wgs84ToGcj02 } from '../utils/wgs84ToGcj02';

const AMAP_KEY = '944bd085212b846ede2315d3d240a199';
const DEFAULT_CENTER = { latitude: 39.90923, longitude: 116.397428 };

function loadAMap() {
  return new Promise((resolve) => {
    if (window.AMap) {
      resolve(window.AMap);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
    script.async = true;
    script.onload = () => resolve(window.AMap);
    document.head.appendChild(script);
  });
}

function isSecureOriginError(err) {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('secure origin') || msg.includes('only secure origins');
}

export default function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [location, setLocation] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationFromClick, setLocationFromClick] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const clusterRef = useRef(null);
  const boundsDebounceRef = useRef(null);
  const [questionTarget, setQuestionTarget] = useState(null);
  const [questionContent, setQuestionContent] = useState('');
  const [questionPrice, setQuestionPrice] = useState('10');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);

  // 根据当前地图视野加载用户（只加载这一块区域，最多 2000 个）
  const loadUsersForCurrentBounds = useCallback(async () => {
    if (!window.AMap || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const bounds = map.getBounds && map.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast && bounds.getNorthEast();
    const sw = bounds.getSouthWest && bounds.getSouthWest();
    if (!ne || !sw) return;

    const payload = {
      north: typeof ne.lat === 'function' ? ne.lat() : ne.lat,
      south: typeof sw.lat === 'function' ? sw.lat() : sw.lat,
      east: typeof ne.lng === 'function' ? ne.lng() : ne.lng,
      west: typeof sw.lng === 'function' ? sw.lng() : sw.lng,
    };

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c0d4a3b9-3042-437e-b276-a7da0d0c971b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '27eed3',
      },
      body: JSON.stringify({
        sessionId: '27eed3',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'MapPage.jsx:loadUsersForCurrentBounds',
        message: 'loadUsersForCurrentBounds called',
        data: { bounds: payload },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    try {
      setLoading(true);
      setError('');
      const data = await api.getNearbyUsers(payload);
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c0d4a3b9-3042-437e-b276-a7da0d0c971b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '27eed3',
        },
        body: JSON.stringify({
          sessionId: '27eed3',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'MapPage.jsx:loadUsersForCurrentBounds',
          message: 'getNearbyUsers failed',
          data: { errorMessage: e?.message || '', name: e?.name || '' },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setError(e.message || '获取附近用户失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setLoading(true);

    const run = async () => {
      try {
        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('浏览器不支持定位'));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
          });
        });
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        const gcj = wgs84ToGcj02(rawLat, rawLng);
        if (cancelled) return;
        setLocation(gcj);
        setLocationFromClick(false);
        // 浏览器定位成功后，仅更新后端中的“我的位置”
        try {
          await api.updateLocation(gcj.latitude, gcj.longitude);
        } catch (e) {
          // 位置更新失败不影响后续地图加载，只在需要时提示
          console.error('更新位置失败:', e);
        }
      } catch (err) {
        if (cancelled) return;
        if (isSecureOriginError(err)) {
          setError('当前为 HTTP 访问，无法使用浏览器定位。请使用 HTTPS，或点击地图选择位置查看附近用户。');
          setLocation(DEFAULT_CENTER);
          setLocationFromClick(true);
        } else {
          setError(err.message || '定位失败。可点击地图选择位置查看附近用户。');
          setLocation(DEFAULT_CENTER);
          setLocationFromClick(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!location || !mapRef.current) return;
    const center = [location.longitude, location.latitude];

    const init = async () => {
      try {
        const amap = await loadAMap();
        const map = new amap.Map(mapRef.current, {
          zoom: 15,
          center,
          viewMode: '2D',
        });
        mapInstanceRef.current = map;
        new amap.Marker({
          position: center,
          map,
          title: locationFromClick ? '所选位置' : '我的位置',
        });
        if (locationFromClick) {
          map.on('click', (e) => {
            const lnglat = e.lnglat;
            const lat = lnglat.getLat();
            const lng = lnglat.getLng();
            setLocation({ latitude: lat, longitude: lng });
            setError('');
          });
        }

        // 初次加载当前视野内的用户
        await loadUsersForCurrentBounds();

        // 地图移动 / 缩放后，重新按视野加载用户（增加防抖，避免高频请求）
        const scheduleLoad = () => {
          if (boundsDebounceRef.current) {
            clearTimeout(boundsDebounceRef.current);
          }
          boundsDebounceRef.current = setTimeout(() => {
            loadUsersForCurrentBounds();
          }, 400);
        };

        map.on('moveend', scheduleLoad);
        map.on('zoomend', scheduleLoad);
        setMapReady(true);
      } catch (e) {
        console.error('高德地图加载失败', e);
      }
    };
    init();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [location?.latitude, location?.longitude, locationFromClick, loadUsersForCurrentBounds]);

  useEffect(() => {
    if (!window.AMap || !mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // 清除旧的聚合和标记
    if (clusterRef.current && clusterRef.current.clearMarkers) {
      clusterRef.current.clearMarkers();
    }
    clusterRef.current = null;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (!users.length) return;

    const markers = [];
    users.forEach((u) => {
      if (!u.lat || !u.lng) return;
      const marker = new window.AMap.Marker({
        position: [u.lng, u.lat],
        map,
        title: u.name,
      });
      marker.on('click', () => navigate(`/chats/${u.id}`));
      markers.push(marker);
    });

    markersRef.current = markers;

    // 使用 MarkerClusterer 进行聚合展示；若插件不可用则退化为普通标记
    if (markers.length && window.AMap.MarkerClusterer) {
      clusterRef.current = new window.AMap.MarkerClusterer(map, markers, {
        gridSize: 60,
      });
    }
  }, [mapReady, users, navigate]);

  return (
    <div className="map-page">
      <div className="map-container" ref={mapRef} />
      {loading && <div className="map-overlay hint-text">定位中…</div>}
      {error && <div className="map-overlay field-error">{error}</div>}
      <div className="map-sidebar">
        <h3 className="map-sidebar-title">附近的人</h3>
        <div className="map-user-list">
          {users.length === 0 && !loading && <div className="hint-text">附近暂无用户</div>}
          {users.map((u) => (
            <button
              key={u.id}
              className="map-user-card"
              onClick={() => navigate(`/chats/${u.id}`)}
            >
              <div className="map-user-avatar">
                <img src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} alt={u.name} />
              </div>
              <div className="map-user-info">
                <span className="map-user-name">{u.name}</span>
                {u.tags && u.tags.length > 0 && (
                  <span className="map-user-tags">{u.tags.map((t) => t.name).join(' · ')}</span>
                )}
              </div>
              <div className="map-user-actions">
                <span
                  className="map-user-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/chats/${u.id}`);
                  }}
                >
                  发消息
                </span>
                <span
                  className="map-user-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuestionTarget(u);
                    setQuestionContent('');
                    setQuestionPrice('10');
                  }}
                >
                  悬赏提问
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {questionTarget && (
        <div className="question-dialog-overlay" onClick={() => setQuestionTarget(null)}>
          <div className="question-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="question-dialog-title">向 {questionTarget.name} 发起悬赏提问</h3>
            <label className="field-label">
              问题内容
              <textarea
                className="field-input question-dialog-textarea"
                value={questionContent}
                onChange={(e) => setQuestionContent(e.target.value)}
                placeholder="请输入你的问题…"
                rows={4}
              />
            </label>
            <label className="field-label">
              赏金（元）
              <input
                type="number"
                className="field-input"
                min={0.01}
                max={10000}
                step={1}
                value={questionPrice}
                onChange={(e) => setQuestionPrice(e.target.value)}
                placeholder="10"
              />
            </label>
            <div className="question-dialog-actions">
              <button className="ghost-button" onClick={() => setQuestionTarget(null)}>
                取消
              </button>
              <button
                className="primary-button"
                disabled={!questionContent.trim() || questionSubmitting}
                onClick={async () => {
                  const content = questionContent.trim();
                  const price = Number(questionPrice);
                  if (!content || !price || Number.isNaN(price) || price <= 0) {
                    return;
                  }
                  setQuestionSubmitting(true);
                  try {
                    await api.createQuestion({
                      answererId: questionTarget.id,
                      content,
                      price,
                    });
                    setQuestionTarget(null);
                    setQuestionContent('');
                    setQuestionPrice('10');
                    alert('已向对方发起悬赏提问，可在聊天里继续交流。');
                  } catch (err) {
                    setError(err.message || '发送悬赏提问失败');
                  } finally {
                    setQuestionSubmitting(false);
                  }
                }}
              >
                {questionSubmitting ? '提交中…' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
