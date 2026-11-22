// Line icons (lucide) keyed by short names used in content.json, plus the Carbon School mark.
import React from 'react';
import {
  Flame, Truck, Zap, PlugZap, Snowflake, Package, Plane, Bus, ThermometerSnowflake, ReceiptText, Database, Gauge, BookOpen, Wheat,
  ClipboardList, ShoppingBag, Store, Handshake, Factory, House, KeyRound, Fuel, Trash2, Bike, Building2, FileCheck2, Ban, Waypoints,
  MapPin, Ruler, LibraryBig, Check, X, Timer, Lock, Users, Trophy, CircleHelp, WifiOff, Hand, Eye, Hourglass, ChartColumn, Mic,
  Smartphone, Layers, Lightbulb, TriangleAlert, CircleCheck, CircleX, CircleMinus, Scale, Calculator, Coins, Landmark, Award,
  FileText, Cylinder, Wrench, Sun, Pin, Volume2, Circle, Banknote, UserX, ChevronDown, ChevronRight, Star, Download, Save, RotateCcw, Pencil, Vote,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  flame: Flame, truck: Truck, zap: Zap, 'plug-zap': PlugZap, snowflake: Snowflake, package: Package, plane: Plane, bus: Bus,
  'thermometer-snowflake': ThermometerSnowflake, receipt: ReceiptText, database: Database, gauge: Gauge, 'book-open': BookOpen, wheat: Wheat,
  'clipboard-list': ClipboardList, 'shopping-bag': ShoppingBag, store: Store, handshake: Handshake, factory: Factory, house: House,
  key: KeyRound, fuel: Fuel, trash: Trash2, bike: Bike, building: Building2, 'file-check': FileCheck2, ban: Ban, waypoints: Waypoints,
  'map-pin': MapPin, ruler: Ruler, library: LibraryBig, check: Check, x: X, timer: Timer, lock: Lock, users: Users, trophy: Trophy,
  help: CircleHelp, 'wifi-off': WifiOff, hand: Hand, eye: Eye, hourglass: Hourglass, chart: ChartColumn, mic: Mic, phone: Smartphone,
  layers: Layers, bulb: Lightbulb, alert: TriangleAlert, 'circle-check': CircleCheck, 'circle-x': CircleX, 'circle-minus': CircleMinus,
  scale: Scale, calculator: Calculator, coins: Coins, landmark: Landmark, award: Award, file: FileText, cylinder: Cylinder, pin: Pin,
  volume: Volume2, banknote: Banknote, 'user-x': UserX, 'chevron-down': ChevronDown, 'chevron-right': ChevronRight, star: Star,
  wrench: Wrench, sun: Sun, download: Download, save: Save, undo: RotateCcw, pencil: Pencil, vote: Vote,
};
// Older content files stored an emoji in `icon`; map those to the same line icons so nothing renders as an emoji.
const LEGACY: Record<string, string> = {
  '🔥': 'flame', '🚐': 'truck', '🚚': 'truck', '⚡': 'zap', '🔌': 'plug-zap', '❄️': 'snowflake', '❄': 'snowflake', '📦': 'package', '✈️': 'plane', '✈': 'plane',
  '🚌': 'bus', '🧊': 'thermometer-snowflake', '🧾': 'receipt', '📚': 'library', '📖': 'book-open', '🌾': 'wheat', '🛍️': 'shopping-bag', '🛍': 'shopping-bag',
  '🥖': 'store', '🤝': 'handshake', '🏭': 'factory', '🏠': 'house', '🔑': 'key', '⛽': 'fuel', '🗑️': 'trash', '🗑': 'trash', '🛢️': 'cylinder', '🛢': 'cylinder',
  '🛵': 'bike', '📝': 'file-check', '🚫': 'ban', '🔗': 'waypoints', '📏': 'ruler', '💡': 'bulb', '📋': 'clipboard-list', '🗂️': 'file', '💵': 'banknote', '🔧': 'wrench', '📜': 'file', '☀️': 'sun', '🛺': 'bus',
};
export const iconKey = (name?: string) => (name && (ICONS[name] ? name : LEGACY[name])) || 'circle';

export function Icon({ name, className = '', label }: { name?: string; className?: string; label?: string }) {
  const C = ICONS[iconKey(name)] || Circle;
  return <C className={`ico ${className}`} width="1em" height="1em" strokeWidth={1.75} aria-hidden={label ? undefined : true} aria-label={label} focusable={false} />;
}

// Carbon School mark: a six-carbon ring.
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={`logo ${className}`} viewBox="0 0 32 32" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M16 3 27.3 9.5v13L16 29 4.7 22.5v-13z" />
      <path d="M16 8.6 22.4 12.3M22.4 19.7 16 23.4M9.6 19.7v-7.4" strokeWidth="2" />
    </svg>
  );
}

// Team marker: a coloured tile with the team's initial (replaces team emoji).
export function TeamMark({ team, lang, className = '' }: { team: { name: { en: string; ar?: string }; color: string }; lang: string; className?: string }) {
  const n = ((lang === 'ar' && team.name.ar) || team.name.en).replace(/^(Team|فريق)\s+/i, '').replace(/^ال/, '');
  return <span className={`tmark ${className}`} style={{ background: team.color }} aria-hidden="true">{n.charAt(0).toUpperCase()}</span>;
}
