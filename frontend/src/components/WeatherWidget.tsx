// src/components/WeatherWidget.tsx - Beautiful weather widget with care-relevant alerts
import React, { useState, useEffect, useMemo, useCallback } from 'react';

interface WeatherDay {
  day: string;
  temp: number;
  low: number;
  condition: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy';
  humidity: number;
  wind: number;
  icon: string;
}

interface CareAlert {
  type: 'cold' | 'heat' | 'uv' | 'wind' | 'ice' | 'rain';
  message: string;
  severity: 'info' | 'warning' | 'urgent';
  icon: string;
}

interface CurrentWeather {
  temp: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  condition: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy';
  pressure: number;
  visibility: string;
  uvIndex: number;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };
  daily: {
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    uv_index_max: number[];
  };
}

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=53.49&longitude=-2.29&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=Europe/London&forecast_days=3';

function mapWeatherCode(code: number): { condition: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy'; icon: string } {
  if (code === 0) return { condition: 'sunny', icon: '☀️' };
  if (code >= 1 && code <= 3) return { condition: 'partly-cloudy', icon: '⛅' };
  if (code >= 45 && code <= 48) return { condition: 'cloudy', icon: '🌫️' };
  if (code >= 51 && code <= 67) return { condition: 'rainy', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { condition: 'cloudy', icon: '🌨️' };
  if (code >= 80 && code <= 99) return { condition: 'stormy', icon: '⛈️' };
  return { condition: 'partly-cloudy', icon: '⛅' };
}

function getSimulatedWeather(now: Date): { current: CurrentWeather; forecast: WeatherDay[] } {
  const month = now.getMonth();
  const baseTemps: Record<number, number> = {
    0: 5, 1: 6, 2: 8, 3: 11, 4: 14, 5: 17,
    6: 19, 7: 19, 8: 16, 9: 12, 10: 8, 11: 6
  };
  const conditions: Array<'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy'> = ['cloudy', 'partly-cloudy', 'rainy', 'sunny', 'stormy'];
  const conditionIndex = month >= 10 || month <= 2 ? 0 : month >= 5 && month <= 8 ? 1 : 2;
  const temp = baseTemps[month] + Math.round((Math.sin(now.getHours() / 3.8) * 3));
  const condition = conditions[conditionIndex];
  const humidity = 72 + Math.round(Math.sin(now.getDate()) * 10);
  const wind = 8 + Math.round(Math.cos(now.getDate()) * 5);

  const current: CurrentWeather = {
    temp,
    feelsLike: temp - 2,
    humidity,
    wind,
    condition,
    pressure: 1013 + Math.round(Math.sin(now.getDate() / 3) * 8),
    visibility: 'Good',
    uvIndex: month >= 5 && month <= 8 ? 5 : 1,
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = now.getDay();
  const forecast: WeatherDay[] = [
    { day: 'Today', temp: current.temp, low: current.temp - 4, condition: current.condition, humidity: current.humidity, wind: current.wind, icon: current.condition === 'sunny' ? '☀️' : current.condition === 'partly-cloudy' ? '⛅' : current.condition === 'rainy' ? '🌧️' : '☁️' },
    { day: days[(today + 1) % 7], temp: current.temp + 1, low: current.temp - 3, condition: 'partly-cloudy', humidity: 68, wind: 12, icon: '⛅' },
    { day: days[(today + 2) % 7], temp: current.temp - 1, low: current.temp - 5, condition: 'rainy', humidity: 82, wind: 15, icon: '🌧️' },
  ];

  return { current, forecast };
}

export default function WeatherWidget() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [liveWeather, setLiveWeather] = useState<CurrentWeather | null>(null);
  const [liveForecast, setLiveForecast] = useState<WeatherDay[] | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchWeather = useCallback(async () => {
    try {
      const response = await fetch(OPEN_METEO_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: OpenMeteoResponse = await response.json();

      const currentCode = data.current.weather_code;
      const { condition } = mapWeatherCode(currentCode);

      const current: CurrentWeather = {
        temp: Math.round(data.current.temperature_2m),
        feelsLike: Math.round(data.current.apparent_temperature),
        humidity: Math.round(data.current.relative_humidity_2m),
        wind: Math.round(data.current.wind_speed_10m),
        condition,
        pressure: 1013, // Not fetched from API, use standard value
        visibility: 'Good',
        uvIndex: Math.round(data.daily.uv_index_max[0]),
      };

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date().getDay();
      const forecast: WeatherDay[] = data.daily.temperature_2m_max.map((maxTemp, i) => {
        const dayCode = data.daily.weather_code[i];
        const mapped = mapWeatherCode(dayCode);
        return {
          day: i === 0 ? 'Today' : days[(today + i) % 7],
          temp: Math.round(maxTemp),
          low: Math.round(data.daily.temperature_2m_min[i]),
          condition: mapped.condition,
          humidity: current.humidity, // Use current humidity as approximation
          wind: current.wind,
          icon: mapped.icon,
        };
      });

      setLiveWeather(current);
      setLiveForecast(forecast);
      setIsLive(true);
    } catch {
      // On error, fall back to simulated data
      setIsLive(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    // Refresh weather every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // Use live data if available, otherwise fall back to simulated
  const simulated = useMemo(() => getSimulatedWeather(currentTime), [currentTime]);
  const currentWeather = liveWeather || simulated.current;
  const forecast = liveForecast || simulated.forecast;

  const careAlerts: CareAlert[] = useMemo(() => {
    const alerts: CareAlert[] = [];
    if (currentWeather.temp <= 5) {
      alerts.push({ type: 'cold', message: 'Cold weather protocol active. Check heating in all rooms and ensure residents have warm clothing.', severity: 'warning', icon: '🥶' });
    }
    if (currentWeather.temp <= 2) {
      alerts.push({ type: 'ice', message: 'Potential ice on paths. Salt walkways and advise residents to avoid outdoor areas.', severity: 'urgent', icon: '🧊' });
    }
    if (currentWeather.temp >= 25) {
      alerts.push({ type: 'heat', message: 'High temperature alert. Increase fluid rounds and close blinds in south-facing rooms.', severity: 'warning', icon: '🌡️' });
    }
    if (currentWeather.uvIndex >= 4) {
      alerts.push({ type: 'uv', message: 'High UV levels today. Residents should wear hats and sunscreen if going outdoors.', severity: 'info', icon: '☀️' });
    }
    if (currentWeather.wind >= 15) {
      alerts.push({ type: 'wind', message: 'Strong winds expected. Secure garden furniture and consider keeping residents indoors.', severity: 'info', icon: '💨' });
    }
    if (currentWeather.condition === 'rainy') {
      alerts.push({ type: 'rain', message: 'Wet conditions. Ensure non-slip mats at all entrances and dry floors promptly.', severity: 'info', icon: '🌧️' });
    }
    if (alerts.length === 0) {
      alerts.push({ type: 'info' as any, message: 'No weather-related care concerns today. Conditions suitable for outdoor activities.', severity: 'info', icon: '✅' });
    }
    return alerts;
  }, [currentWeather]);

  const getGradient = () => {
    const hour = currentTime.getHours();
    if (hour >= 6 && hour < 12) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    if (hour >= 12 && hour < 17) return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    if (hour >= 17 && hour < 20) return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    return 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)';
  };

  const getConditionIcon = () => {
    const hour = currentTime.getHours();
    if (currentWeather.condition === 'rainy') return '🌧️';
    if (currentWeather.condition === 'stormy') return '⛈️';
    if (currentWeather.condition === 'cloudy') return '☁️';
    if (hour >= 20 || hour < 6) return '🌙';
    if (currentWeather.condition === 'sunny') return '☀️';
    return '⛅';
  };

  const getSeverityStyle = (severity: string) => {
    if (severity === 'urgent') return { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' };
    if (severity === 'warning') return { bg: '#fffbeb', border: '#fde68a', color: '#d97706' };
    return { bg: '#eff6ff', border: '#bfdbfe', color: '#0d9488' };
  };

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
      {/* Main Weather Display */}
      <div style={{ background: getGradient(), padding: '20px 24px', color: '#fff', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              SALFORD, UK
              {isLive && (
                <span style={{ background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3 }}>
                  Live
                </span>
              )}
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.1, marginTop: 4 }}>
              {currentWeather.temp}&deg;C
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Feels like {currentWeather.feelsLike}&deg;C
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2, textTransform: 'capitalize' }}>
              {currentWeather.condition.replace('-', ' ')}
            </div>
          </div>
          <div style={{ fontSize: 52, textShadow: '0 2px 10px rgba(0,0,0,.2)' }}>
            {getConditionIcon()}
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.2)' }}>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            <span style={{ opacity: 0.7 }}>Humidity</span>
            <div style={{ fontWeight: 700 }}>{currentWeather.humidity}%</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            <span style={{ opacity: 0.7 }}>Wind</span>
            <div style={{ fontWeight: 700 }}>{currentWeather.wind} km/h</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            <span style={{ opacity: 0.7 }}>Pressure</span>
            <div style={{ fontWeight: 700 }}>{currentWeather.pressure} hPa</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            <span style={{ opacity: 0.7 }}>UV Index</span>
            <div style={{ fontWeight: 700 }}>{currentWeather.uvIndex}</div>
          </div>
        </div>
      </div>

      {/* 3-Day Forecast */}
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 0.5 }}>3-DAY FORECAST</div>
        <div style={{ display: 'flex', gap: 0 }}>
          {forecast.map((day, i) => (
            <div key={day.day} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: i < forecast.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{day.day}</div>
              <div style={{ fontSize: 22, margin: '4px 0' }}>{day.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{day.temp}&deg;</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{day.low}&deg;</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{day.wind}km/h</div>
            </div>
          ))}
        </div>
      </div>

      {/* Care-Relevant Alerts */}
      <div style={{ padding: '14px 24px 16px', background: '#fafafa' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 0.5 }}>CARE ALERTS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {careAlerts.map((alert, i) => {
            const style = getSeverityStyle(alert.severity);
            return (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: style.bg, border: `1px solid ${style.border}`, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{alert.icon}</span>
                <div style={{ fontSize: 12, color: style.color, fontWeight: 500, lineHeight: 1.4 }}>
                  {alert.message}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
