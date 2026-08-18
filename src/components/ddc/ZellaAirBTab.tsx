'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type PlanTier, PLAN_DISPLAY } from '@/lib/plan-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Home,
  Plus,
  Search,
  ExternalLink,
  MapPin,
  BedDouble,
  Bath,
  Users,
  Wifi,
  Key,
  Star,
  Loader2,
  Sparkles,
  Trash2,
  Eye,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Clock,
  Shield,
  Zap,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowLeft,
  Map,
  Phone,
  Compass,
  Building,
  Waves,
  ShoppingBag,
  Pill,
  UtensilsCrossed,
  Landmark,
  Heart,
  Bus,
  Edit3,
  Save,
  PlusCircle,
  Lock,
  Crown,
  TrendingUp,
} from 'lucide-react';
import { AirBProPanel } from '@/components/ddc/airb-pro/AirBProPanel';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RegionalPOI {
  id?: string;
  category: string;
  name: string;
  distance?: number | null;
  walkingTimeMin?: number | null;
  drivingTimeMin?: number | null;
  address?: string | null;
  rating?: number | null;
  description?: string | null;
}

interface AirBPropertyData {
  id: string;
  airbnbId: string | null;
  airbnbUrl: string | null;
  name: string;
  description: string;
  propertyType: string;
  city: string;
  state: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  amenities: string;
  houseRules: string;
  checkinTime: string;
  checkoutTime: string;
  wifiName: string | null;
  wifiPassword: string | null;
  lockProvider: string | null;
  lockCode: string | null;
  imageUrl: string | null;
  pricePerNight: number | null;
  status: string;
  scrapedAt: string | null;
  scrapingSource: string | null;
  latitude: number | null;
  longitude: number | null;
  hostKnowledge: string;
  neighborhoodTips: string;
  emergencyContacts: string;
  _count?: { conversations: number; regionalKnowledge: number };
  createdAt: string;
}

interface AirBConversationData {
  id: string;
  guestName: string;
  guestPhone: string | null;
  mode: string;
  status: string;
  platformContext: string;
  lastIntent: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  property: { name: string };
  messages?: Array<{
    id: string;
    direction: string;
    content: string;
    intent: string | null;
    isAiGenerated: boolean;
    createdAt: string;
  }>;
  createdAt: string;
}

interface EntitlementError {
  currentCount: number;
  maxAllowed: number;
  upgradeRequired: boolean;
  reason: string | null;
  planType: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PROPERTY_TYPES: Record<string, string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  loft: 'Loft',
  studio: 'Studio',
  chalet: 'Chalé',
  villa: 'Villa',
};

const MAX_PROPERTIES: Record<string, number> = { pro: 4, max: 12 };

const POI_CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  beach: { label: 'Praia', icon: Waves, color: 'text-cyan-400' },
  bakery: { label: 'Padaria', icon: ShoppingBag, color: 'text-amber-400' },
  pharmacy: { label: 'Farmácia', icon: Pill, color: 'text-green-400' },
  supermarket: { label: 'Mercado', icon: ShoppingBag, color: 'text-orange-400' },
  restaurant: { label: 'Restaurante', icon: UtensilsCrossed, color: 'text-rose-400' },
  tourism: { label: 'Turismo', icon: Landmark, color: 'text-purple-400' },
  hospital: { label: 'Hospital', icon: Heart, color: 'text-red-400' },
  transport: { label: 'Transporte', icon: Bus, color: 'text-blue-400' },
  atm: { label: 'ATM', icon: Building, color: 'text-zinc-400' },
  leisure: { label: 'Lazer', icon: Compass, color: 'text-pink-400' },
  other: { label: 'Outro', icon: MapPin, color: 'text-zinc-400' },
};

const PLATFORM_CONTEXT_CONFIG: Record<string, { label: string; color: string }> = {
  airbnb_app: { label: 'Airbnb App', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  airbnb_web: { label: 'Airbnb Web', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  whatsapp: { label: 'WhatsApp', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  direct: { label: 'Direto', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  unknown: { label: 'Desconhecido', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

const DEMO_PROPERTIES = [
  { airbnbId: '18584298', name: 'Apartamento Vista Mar - Jurerê Internacional', city: 'Florianópolis', state: 'SC', propertyType: 'apartment', bedrooms: 2, bathrooms: 1, maxGuests: 4, pricePerNight: 350, neighborhood: 'Jurerê Internacional', imageUrl: '' },
  { airbnbId: '9283741', name: 'Studio Moderno - Copacabana', city: 'Rio de Janeiro', state: 'RJ', propertyType: 'studio', bedrooms: 1, bathrooms: 1, maxGuests: 2, pricePerNight: 220, neighborhood: 'Copacabana', imageUrl: '' },
  { airbnbId: '51928403', name: 'Casa com Piscina - Campos do Jordão', city: 'Campos do Jordão', state: 'SP', propertyType: 'house', bedrooms: 3, bathrooms: 2, maxGuests: 6, pricePerNight: 580, neighborhood: 'Alto do Capivari', imageUrl: '' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function PropertyCard({ property, onDelete, onViewDetails }: { property: AirBPropertyData; onDelete: (id: string) => void; onViewDetails: (id: string) => void }) {
  const amenities = JSON.parse(property.amenities || '[]');
  const regionalCount = property._count?.regionalKnowledge || 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#121216]/80 border border-white/[0.06] rounded-xl overflow-hidden hover:border-emerald-500/20 transition-all group"
    >
      {/* Image placeholder */}
      <div className="h-32 bg-gradient-to-br from-emerald-900/30 to-teal-900/20 flex items-center justify-center relative">
        <Home className="w-10 h-10 text-emerald-500/30" />
        {property.airbnbId && (
          <a
            href={property.airbnbUrl || `https://www.airbnb.com.br/rooms/${property.airbnbId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 p-1.5 rounded-md bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 text-[#FF5A5F] hover:bg-[#FF5A5F]/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {property.scrapedAt && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] font-bold text-emerald-400 uppercase">Auto-filled</span>
          </div>
        )}
        {regionalCount > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
            <Map className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-bold text-cyan-400">{regionalCount} POIs</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-white truncate">{property.name}</h4>
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="text-[11px] text-zinc-400 truncate">{property.neighborhood}{property.neighborhood && ', '}{property.city}/{property.state}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1"><BedDouble className="w-3 h-3" />{property.bedrooms}</div>
          <div className="flex items-center gap-1"><Bath className="w-3 h-3" />{property.bathrooms}</div>
          <div className="flex items-center gap-1"><Users className="w-3 h-3" />{property.maxGuests}</div>
          {property.wifiName && <div className="flex items-center gap-1"><Wifi className="w-3 h-3 text-emerald-400" /></div>}
          {property.lockCode && <div className="flex items-center gap-1"><Key className="w-3 h-3 text-amber-400" /></div>}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div>
            {property.pricePerNight && (
              <span className="text-sm font-bold text-white">R${property.pricePerNight}</span>
            )}
            {property.pricePerNight && <span className="text-[10px] text-zinc-500">/noite</span>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              {PROPERTY_TYPES[property.propertyType] || property.propertyType}
            </Badge>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => onViewDetails(property.id)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <Eye className="w-3 h-3" />
            Ver Detalhes
          </button>
          <button
            onClick={() => onDelete(property.id)}
            className="p-1 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {property._count && property._count.conversations > 0 && (
          <div className="flex items-center gap-1.5 pt-1">
            <MessageSquare className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-bold">{property._count.conversations} conversa{property._count.conversations > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ConversationRow({ conversation }: { conversation: AirBConversationData }) {
  const modeLabel = conversation.mode === 'pre_booking' ? 'Pré-reserva' : 'Pós-reserva';
  const modeColor = conversation.mode === 'pre_booking' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  const statusColor = conversation.status === 'active' ? 'text-emerald-400' : conversation.status === 'escalated' ? 'text-amber-400' : 'text-zinc-400';
  const platformConfig = PLATFORM_CONTEXT_CONFIG[conversation.platformContext] || PLATFORM_CONTEXT_CONFIG.unknown;

  return (
    <div className="flex items-center gap-4 py-3 px-4 bg-[#121216]/40 border border-white/[0.03] rounded-lg hover:border-white/[0.06] transition-colors">
      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-emerald-400">{conversation.guestName.charAt(0)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-white">{conversation.guestName}</span>
          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${modeColor}`}>{modeLabel}</Badge>
          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${platformConfig.color}`}>{platformConfig.label}</Badge>
        </div>
        <span className="text-[10px] text-zinc-500 block">{conversation.property.name}</span>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-[10px] font-bold ${statusColor}`}>{conversation.status}</span>
        <span className="text-[10px] text-zinc-600 block">{conversation.messageCount} msgs</span>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
    </div>
  );
}

function PlanGateCard({ entitlement, onUpgrade }: { entitlement: EntitlementError; onUpgrade: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-6 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
        <Crown className="w-6 h-6 text-amber-400" />
      </div>
      <h3 className="text-sm font-bold text-white mb-2">Limite do plano atingido</h3>
      <p className="text-xs text-zinc-400 mb-4">
        Você tem <span className="text-white font-bold">{entitlement.currentCount}</span> de <span className="text-white font-bold">{entitlement.maxAllowed}</span> imóveis permitidos.
        {entitlement.upgradeRequired && ' Faça upgrade para adicionar mais.'}
      </p>
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="flex -space-x-1">
          {Array.from({ length: entitlement.maxAllowed }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-full border-2 border-[#121216] flex items-center justify-center ${
                i < entitlement.currentCount ? 'bg-amber-500/20' : 'bg-zinc-800'
              }`}
            >
              <Home className={`w-3 h-3 ${i < entitlement.currentCount ? 'text-amber-400' : 'text-zinc-600'}`} />
            </div>
          ))}
        </div>
      </div>
      {entitlement.upgradeRequired && (
        <Button
          onClick={onUpgrade}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold gap-2"
        >
          <Crown className="w-3.5 h-3.5" />
          Upgrade para MAX
        </Button>
      )}
    </motion.div>
  );
}

function RegionalKnowledgeSection({ pois, loading }: { pois: RegionalPOI[]; loading: boolean }) {
  // Group POIs by category
  const grouped = pois.reduce<Record<string, RegionalPOI[]>>((acc, poi) => {
    const cat = poi.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(poi);
    return acc;
  }, {});

  // Sort categories by defined order
  const categoryOrder = ['beach', 'supermarket', 'bakery', 'pharmacy', 'restaurant', 'tourism', 'hospital', 'transport', 'atm', 'leisure', 'other'];
  const sortedCategories = Object.keys(grouped).sort((a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        <span className="text-xs text-zinc-400 ml-2">Carregando conhecimento regional...</span>
      </div>
    );
  }

  if (pois.length === 0) {
    return (
      <div className="text-center py-6 bg-[#121216]/40 border border-white/[0.03] rounded-lg">
        <Map className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-xs text-zinc-400">Nenhum conhecimento regional cadastrado.</p>
        <p className="text-[10px] text-zinc-600">Use o Magic Onboarding para descobrir POIs automaticamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedCategories.map(category => {
        const config = POI_CATEGORY_CONFIG[category] || POI_CATEGORY_CONFIG.other;
        const Icon = config.icon;
        const items = grouped[category];
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${config.color}`} />
              <span className="text-xs font-bold text-white">{config.label}</span>
              <Badge variant="outline" className="text-[8px] px-1 py-0 bg-white/[0.03] text-zinc-400 border-white/[0.06]">
                {items.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((poi, idx) => (
                <div
                  key={poi.id || `${category}-${idx}`}
                  className="flex items-start gap-3 p-3 bg-[#121216]/60 border border-white/[0.03] rounded-lg hover:border-white/[0.06] transition-colors"
                >
                  <div className={`w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-[11px] font-bold text-white truncate">{poi.name}</h5>
                    {poi.description && (
                      <p className="text-[10px] text-zinc-500 line-clamp-1">{poi.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {poi.distance != null && (
                        <span className="text-[9px] text-zinc-400 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {poi.distance}km
                        </span>
                      )}
                      {poi.walkingTimeMin != null && (
                        <span className="text-[9px] text-zinc-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {poi.walkingTimeMin} min
                        </span>
                      )}
                      {poi.rating != null && (
                        <span className="text-[9px] text-amber-400 flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" />
                          {poi.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HostKnowledgeEditor({ propertyId, initialKnowledge, onSave }: { propertyId: string; initialKnowledge: string; onSave: (items: string[]) => Promise<void> }) {
  const [items, setItems] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(initialKnowledge || '[]');
      return Array.isArray(parsed) ? parsed.map((k: any) => typeof k === 'string' ? k : JSON.stringify(k)) : [];
    } catch {
      return [];
    }
  });
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(items);
      toast.success('Conhecimento do anfitrião salvo!');
    } catch {
      toast.error('Erro ao salvar conhecimento do anfitrião.');
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    if (!newItem.trim()) return;
    setItems(prev => [...prev, newItem.trim()]);
    setNewItem('');
  }

  function handleRemove(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2.5 bg-[#121216]/60 border border-white/[0.03] rounded-lg group">
              <span className="text-[10px] text-zinc-500 font-mono shrink-0 mt-0.5">{idx + 1}.</span>
              <span className="text-[11px] text-zinc-300 flex-1">{item}</span>
              <button
                onClick={() => handleRemove(idx)}
                className="p-1 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Adicionar dica do anfitrião..."
          className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs placeholder:text-zinc-600 flex-1"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          size="sm"
          variant="outline"
          className="text-xs border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
        >
          <PlusCircle className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Salvar Conhecimento
        </Button>
      </div>
    </div>
  );
}

function PropertyDetailView({
  property,
  regionalPois,
  regionalLoading,
  onBack,
  onDelete,
  onHostKnowledgeSave,
}: {
  property: AirBPropertyData;
  regionalPois: RegionalPOI[];
  regionalLoading: boolean;
  onBack: () => void;
  onDelete: (id: string) => void;
  onHostKnowledgeSave: (items: string[]) => Promise<void>;
}) {
  const amenities = JSON.parse(property.amenities || '[]');
  const houseRules = JSON.parse(property.houseRules || '[]');
  const emergencyContacts = JSON.parse(property.emergencyContacts || '[]');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      {/* Back + Actions header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="flex items-center gap-2">
          {property.airbnbId && (
            <a
              href={property.airbnbUrl || `https://www.airbnb.com.br/rooms/${property.airbnbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-[#FF5A5F] hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Ver no Airbnb
            </a>
          )}
          <button
            onClick={() => onDelete(property.id)}
            className="p-1.5 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Property title */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-bold text-white">{property.name}</h3>
          {property.scrapedAt && (
            <Badge variant="outline" className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <Sparkles className="w-2.5 h-2.5 mr-0.5" />
              Auto
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <MapPin className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs">{property.neighborhood}{property.neighborhood && ', '}{property.city}/{property.state}</span>
          {property.latitude != null && property.longitude != null && (
            <span className="text-[9px] text-zinc-600 ml-2">({property.latitude.toFixed(4)}, {property.longitude.toFixed(4)})</span>
          )}
        </div>
      </div>

      {/* Basic info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121216]/60 border border-white/[0.04] rounded-lg p-3 text-center">
          <BedDouble className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <span className="text-lg font-bold text-white block">{property.bedrooms}</span>
          <span className="text-[9px] text-zinc-500">Quartos</span>
        </div>
        <div className="bg-[#121216]/60 border border-white/[0.04] rounded-lg p-3 text-center">
          <Bath className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <span className="text-lg font-bold text-white block">{property.bathrooms}</span>
          <span className="text-[9px] text-zinc-500">Banheiros</span>
        </div>
        <div className="bg-[#121216]/60 border border-white/[0.04] rounded-lg p-3 text-center">
          <Users className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <span className="text-lg font-bold text-white block">{property.maxGuests}</span>
          <span className="text-[9px] text-zinc-500">Hóspedes</span>
        </div>
        <div className="bg-[#121216]/60 border border-white/[0.04] rounded-lg p-3 text-center">
          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-1">
            {PROPERTY_TYPES[property.propertyType] || property.propertyType}
          </Badge>
          {property.pricePerNight && (
            <>
              <span className="text-lg font-bold text-white block">R${property.pricePerNight}</span>
              <span className="text-[9px] text-zinc-500">/noite</span>
            </>
          )}
        </div>
      </div>

      {/* Check-in/out & WiFi & Lock */}
      <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          Check-in / Check-out & Acesso
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">Check-in</span>
              <span className="text-xs text-white font-bold">{property.checkinTime || '15:00'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">Check-out</span>
              <span className="text-xs text-white font-bold">{property.checkoutTime || '11:00'}</span>
            </div>
          </div>
          {property.wifiName && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block">WiFi</span>
                <span className="text-xs text-white font-bold">{property.wifiName}</span>
                {property.wifiPassword && <span className="text-[10px] text-zinc-400 ml-1">({property.wifiPassword})</span>}
              </div>
            </div>
          )}
          {property.lockProvider && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block">Fechadura</span>
                <span className="text-xs text-white font-bold">{property.lockProvider}</span>
                {property.lockCode && <span className="text-[10px] text-amber-400 ml-1">#{property.lockCode}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* House Rules */}
      {houseRules.length > 0 && (
        <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
          <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Regras da Casa
          </h4>
          <div className="flex flex-wrap gap-2">
            {houseRules.map((rule: string, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                <X className="w-3 h-3 text-amber-500/50" />
                <span className="text-[10px] text-zinc-300">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amenities */}
      {amenities.length > 0 && (
        <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
          <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Comodidades
          </h4>
          <div className="flex flex-wrap gap-2">
            {amenities.map((amenity: string, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />
                <span className="text-[10px] text-zinc-300">{amenity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regional Knowledge */}
      <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          Conhecimento Regional
          <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
            {regionalPois.length} POIs
          </Badge>
        </h4>
        <RegionalKnowledgeSection pois={regionalPois} loading={regionalLoading} />
      </div>

      {/* Host Knowledge */}
      <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5 text-violet-400" />
          Conhecimento do Anfitrião
          <span className="text-[9px] text-zinc-500">— dicas que a IA usa para responder hóspedes</span>
        </h4>
        <HostKnowledgeEditor
          propertyId={property.id}
          initialKnowledge={property.hostKnowledge}
          onSave={onHostKnowledgeSave}
        />
      </div>

      {/* Emergency Contacts */}
      {emergencyContacts.length > 0 && (
        <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
          <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-red-400" />
            Contatos de Emergência
          </h4>
          <div className="space-y-2">
            {emergencyContacts.map((contact: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 bg-red-500/5 border border-red-500/10 rounded-lg">
                <Phone className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <div>
                  <span className="text-[11px] text-white font-bold">{contact.name || contact.label || `Contato ${idx + 1}`}</span>
                  {contact.phone && <span className="text-[10px] text-zinc-400 ml-2">{contact.phone}</span>}
                  {contact.description && <span className="text-[10px] text-zinc-500 block">{contact.description}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Scrape Progress Component ─────────────────────────────────────────────────

function ScrapeProgress({ step, total }: { step: number; total: number }) {
  const steps = ['Raspando dados do Airbnb', 'Descobrindo conhecimento regional', 'Pronto!'];
  const progress = Math.min(100, (step / total) * 100);

  return (
    <div className="bg-[#121216]/80 border border-[#FF5A5F]/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-[#FF5A5F] animate-spin" />
        <span className="text-xs font-bold text-white">Magic Onboarding em progresso...</span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="bg-gradient-to-r from-[#FF5A5F] to-emerald-500 h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="space-y-1">
        {steps.map((label, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {idx < step ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : idx === step ? (
              <Loader2 className="w-3 h-3 text-[#FF5A5F] animate-spin" />
            ) : (
              <div className="w-3 h-3 rounded-full border border-zinc-700" />
            )}
            <span className={`text-[10px] ${idx <= step ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface ZellaAirBTabProps {
  currentPlan: PlanTier;
  onUpgrade: () => void;
}

export function ZellaAirBTab({ currentPlan, onUpgrade }: ZellaAirBTabProps) {
  // State
  const [properties, setProperties] = useState<AirBPropertyData[]>([]);
  const [conversations, setConversations] = useState<AirBConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeStep, setScrapeStep] = useState(-1); // -1 = not scraping
  const [scrapedRegionalKnowledge, setScrapedRegionalKnowledge] = useState<RegionalPOI[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'properties' | 'conversations' | 'onboarding' | 'pro'>('onboarding');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [regionalPois, setRegionalPois] = useState<RegionalPOI[]>([]);
  const [regionalLoading, setRegionalLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState<EntitlementError | null>(null);
  const [newProperty, setNewProperty] = useState({
    name: '', airbnbId: '', airbnbUrl: '', city: '', state: '', propertyType: 'apartment',
    bedrooms: '1', bathrooms: '1', maxGuests: '2', checkinTime: '15:00', checkoutTime: '11:00',
    wifiName: '', wifiPassword: '', lockProvider: '', lockCode: '', pricePerNight: '',
  });

  // Data loading
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [propRes, convRes] = await Promise.all([
        fetch('/api/ddc/airb/properties'),
        fetch('/api/ddc/airb/conversations'),
      ]);
      if (propRes.ok) {
        const propData = await propRes.json();
        setProperties(propData.data || []);
      }
      if (convRes.ok) {
        const convData = await convRes.json();
        setConversations(convData.data || []);
      }
    } catch (err) {
      console.error('Error loading AirB data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Load regional knowledge when a property is selected
  const loadRegionalKnowledge = useCallback(async (propertyId: string) => {
    setRegionalLoading(true);
    try {
      const res = await fetch(`/api/ddc/airb/regional?propertyId=${propertyId}`);
      if (res.ok) {
        const data = await res.json();
        setRegionalPois(data.data || []);
      } else {
        setRegionalPois([]);
      }
    } catch {
      setRegionalPois([]);
    } finally {
      setRegionalLoading(false);
    }
  }, []);

  // When selecting a property, load its regional data
  useEffect(() => {
    if (selectedPropertyId) {
      loadRegionalKnowledge(selectedPropertyId);
    }
  }, [selectedPropertyId, loadRegionalKnowledge]);

  // Magic Onboarding — Scrape Airbnb listing (enhanced with progress)
  async function handleScrape() {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setScrapeStep(0);
    setEntitlementError(null);
    setScrapedRegionalKnowledge([]);
    try {
      const res = await fetch('/api/ddc/airb/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });

      // Handle 403 entitlement error
      if (res.status === 403) {
        const errData = await res.json();
        setEntitlementError({
          currentCount: errData.currentCount || properties.length,
          maxAllowed: errData.maxAllowed || MAX_PROPERTIES[currentPlan] || 4,
          upgradeRequired: errData.upgradeRequired ?? true,
          reason: errData.error || 'Limite atingido',
          planType: errData.planType || null,
        });
        setScraping(false);
        setScrapeStep(-1);
        return;
      }

      const data = await res.json();
      if (data.success && data.data) {
        setScrapeStep(1); // Step 1: data scraped, now discovering regional

        // Pre-fill the form with scraped data
        const scraped = data.data;
        setNewProperty({
          name: scraped.name || '',
          airbnbId: scraped.airbnbId || '',
          airbnbUrl: scraped.airbnbUrl || scrapeUrl,
          city: scraped.city || '',
          state: scraped.state || '',
          propertyType: scraped.propertyType || 'apartment',
          bedrooms: String(scraped.bedrooms || 1),
          bathrooms: String(scraped.bathrooms || 1),
          maxGuests: String(scraped.maxGuests || 2),
          checkinTime: scraped.checkinTime || '15:00',
          checkoutTime: scraped.checkoutTime || '11:00',
          wifiName: '', wifiPassword: '', lockProvider: '', lockCode: '',
          pricePerNight: scraped.pricePerNight ? String(scraped.pricePerNight) : '',
        });

        // Store regional knowledge from scrape response
        if (data.regionalKnowledge && Array.isArray(data.regionalKnowledge)) {
          setScrapedRegionalKnowledge(data.regionalKnowledge);
        }

        setScrapeStep(2); // Step 2: done
        setShowAddForm(true);
        setActiveSubTab('properties');
        toast.success('Dados do Airbnb capturados! Revise e confirme o cadastro.');
      } else {
        toast.error(data.error || 'Não foi possível raspar os dados do Airbnb.');
        setScrapeStep(-1);
      }
    } catch {
      toast.error('Erro ao conectar com o serviço de scraping.');
      setScrapeStep(-1);
    } finally {
      setScraping(false);
    }
  }

  // Create property
  async function handleCreateProperty() {
    setEntitlementError(null);
    try {
      const res = await fetch('/api/ddc/airb/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProperty,
          bedrooms: Number(newProperty.bedrooms),
          bathrooms: Number(newProperty.bathrooms),
          maxGuests: Number(newProperty.maxGuests),
          pricePerNight: newProperty.pricePerNight ? Number(newProperty.pricePerNight) : null,
        }),
      });

      // Handle 403 entitlement error
      if (res.status === 403) {
        const errData = await res.json();
        setEntitlementError({
          currentCount: errData.currentCount || properties.length,
          maxAllowed: errData.maxAllowed || MAX_PROPERTIES[currentPlan] || 4,
          upgradeRequired: errData.upgradeRequired ?? true,
          reason: errData.error || 'Limite atingido',
          planType: errData.planType || null,
        });
        return;
      }

      const data = await res.json();
      if (data.success) {
        // If we have regional knowledge from scraping, save it
        if (scrapedRegionalKnowledge.length > 0 && data.data?.id) {
          try {
            await fetch('/api/ddc/airb/regional', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                propertyId: data.data.id,
                items: scrapedRegionalKnowledge,
              }),
            });
            toast.success(`Imóvel cadastrado com ${scrapedRegionalKnowledge.length} POIs regionais!`);
          } catch {
            toast.success('Imóvel cadastrado, mas erro ao salvar conhecimento regional.');
          }
        } else {
          toast.success('Imóvel Airbnb cadastrado com sucesso!');
        }
        setShowAddForm(false);
        setScrapedRegionalKnowledge([]);
        setScrapeStep(-1);
        setNewProperty({ name: '', airbnbId: '', airbnbUrl: '', city: '', state: '', propertyType: 'apartment', bedrooms: '1', bathrooms: '1', maxGuests: '2', checkinTime: '15:00', checkoutTime: '11:00', wifiName: '', wifiPassword: '', lockProvider: '', lockCode: '', pricePerNight: '' });
        setScrapeUrl('');
        loadData();
      } else {
        toast.error(data.error || 'Erro ao cadastrar imóvel.');
      }
    } catch {
      toast.error('Erro ao cadastrar imóvel.');
    }
  }

  // Delete property
  async function handleDeleteProperty(id: string) {
    if (!confirm('Tem certeza que deseja remover este imóvel?')) return;
    try {
      const res = await fetch(`/api/ddc/airb/properties?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Imóvel removido.');
        if (selectedPropertyId === id) {
          setSelectedPropertyId(null);
        }
        loadData();
      }
    } catch {
      toast.error('Erro ao remover imóvel.');
    }
  }

  // Save host knowledge
  async function handleHostKnowledgeSave(propertyId: string, items: string[]) {
    try {
      const res = await fetch('/api/ddc/airb/properties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: propertyId,
          hostKnowledge: JSON.stringify(items),
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to save');
      }
      // Update local state
      setProperties(prev => prev.map(p =>
        p.id === propertyId ? { ...p, hostKnowledge: JSON.stringify(items) } : p
      ));
    } catch (err) {
      throw err;
    }
  }

  // View property details
  function handleViewDetails(propertyId: string) {
    setSelectedPropertyId(propertyId);
  }

  function handleBackFromDetails() {
    setSelectedPropertyId(null);
    setRegionalPois([]);
  }

  // Plan limits
  const maxProps = MAX_PROPERTIES[currentPlan] || 4;
  const canAdd = properties.length < maxProps;
  const planLabel = PLAN_DISPLAY[currentPlan]?.label || currentPlan.toUpperCase();

  // Compute total regional POIs across all properties
  const totalRegionalPois = properties.reduce((sum, p) => sum + (p._count?.regionalKnowledge || 0), 0);

  // Get selected property
  const selectedProperty = selectedPropertyId ? properties.find(p => p.id === selectedPropertyId) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF5A5F]/10 flex items-center justify-center border border-[#FF5A5F]/20">
              <Home className="w-4 h-4 text-[#FF5A5F]" />
            </div>
            <h2 className="text-lg font-bold text-white">Zélla AirB</h2>
            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              {planLabel}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Seu zelador digital para imóveis Airbnb — responda como o dono que sabe tudo.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-zinc-500 block">{properties.length}/{maxProps} imóveis</span>
            <span className="text-[10px] text-emerald-400 font-mono">{conversations.filter(c => c.status === 'active').length} conversas ativas</span>
          </div>
          <Button
            onClick={() => { setShowAddForm(true); setActiveSubTab('properties'); }}
            disabled={!canAdd}
            size="sm"
            className="bg-[#FF5A5F] hover:bg-[#FF5A5F]/80 text-white gap-1.5 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Imóvel
          </Button>
        </div>
      </div>

      {/* Magic Onboarding — Scrape Section */}
      <div className="bg-gradient-to-r from-[#FF5A5F]/5 to-transparent border border-[#FF5A5F]/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#FF5A5F]" />
          <span className="text-xs font-bold text-white">Magic Onboarding</span>
          <span className="text-[9px] bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/20 px-1.5 py-0.5 rounded font-bold uppercase">Novo</span>
        </div>
        <p className="text-[11px] text-zinc-400 mb-3">Cole o link do Airbnb ou o código do imóvel e preenchemos o cadastro automaticamente.</p>
        <div className="flex gap-2">
          <Input
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            placeholder="https://www.airbnb.com.br/rooms/18584298 ou código"
            className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs placeholder:text-zinc-600 flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
          />
          <Button
            onClick={handleScrape}
            disabled={scraping || !scrapeUrl.trim()}
            size="sm"
            className="bg-[#FF5A5F] hover:bg-[#FF5A5F]/80 text-white gap-1.5 text-xs font-bold shrink-0"
          >
            {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {scraping ? 'Raspando...' : 'Raspar Dados'}
          </Button>
        </div>

        {/* Scrape Progress */}
        {scrapeStep >= 0 && scraping && (
          <div className="mt-3">
            <ScrapeProgress step={scrapeStep} total={2} />
          </div>
        )}

        {/* Scrape result - show discovered regional knowledge */}
        {scrapedRegionalKnowledge.length > 0 && !scraping && (
          <div className="mt-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold text-white">Conhecimento Regional Descoberto</span>
              <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                {scrapedRegionalKnowledge.length} POIs
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {scrapedRegionalKnowledge.slice(0, 8).map((poi, idx) => {
                const config = POI_CATEGORY_CONFIG[poi.category] || POI_CATEGORY_CONFIG.other;
                const Icon = config.icon;
                return (
                  <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-white/[0.03] border border-white/[0.05] rounded">
                    <Icon className={`w-2.5 h-2.5 ${config.color}`} />
                    <span className="text-[9px] text-zinc-400">{poi.name}</span>
                  </div>
                );
              })}
              {scrapedRegionalKnowledge.length > 8 && (
                <span className="text-[9px] text-zinc-500 px-2 py-1">+{scrapedRegionalKnowledge.length - 8} mais</span>
              )}
            </div>
            <p className="text-[9px] text-zinc-500 mt-2">Será salvo automaticamente ao confirmar o cadastro do imóvel.</p>
          </div>
        )}

        {/* Demo property suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Testar:</span>
          {DEMO_PROPERTIES.map((demo) => (
            <button
              key={demo.airbnbId}
              onClick={() => setScrapeUrl(`https://www.airbnb.com.br/rooms/${demo.airbnbId}`)}
              className="text-[10px] px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-zinc-400 hover:text-white hover:border-white/[0.1] transition-colors cursor-pointer"
            >
              {demo.airbnbId} — {demo.name.split(' - ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Entitlement Error (PlanGate) */}
      {entitlementError && (
        <PlanGateCard entitlement={entitlementError} onUpgrade={onUpgrade} />
      )}

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.04] pb-1">
        <button
          onClick={() => { setActiveSubTab('onboarding'); setSelectedPropertyId(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'onboarding' && !selectedPropertyId
              ? 'text-white bg-white/[0.04] border-b-2 border-[#FF5A5F]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Visão Geral
        </button>
        <button
          onClick={() => { setActiveSubTab('properties'); setSelectedPropertyId(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'properties'
              ? 'text-white bg-white/[0.04] border-b-2 border-[#FF5A5F]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          Imóveis ({properties.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('conversations'); setSelectedPropertyId(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'conversations'
              ? 'text-white bg-white/[0.04] border-b-2 border-[#FF5A5F]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Conversas ({conversations.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('pro'); setSelectedPropertyId(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'pro'
              ? 'text-white bg-white/[0.04] border-b-2 border-[#FF5A5F]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Pro (Relatórios, Financeiro, Operações)
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* ── ONBOARDING / OVERVIEW ─────────────────────────────── */}
        {activeSubTab === 'onboarding' && !selectedPropertyId && (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
                <Home className="w-4 h-4 text-[#FF5A5F] mb-2" />
                <span className="text-xl font-bold text-white block">{properties.filter(p => p.status === 'active').length}</span>
                <span className="text-[10px] text-zinc-500">Imóveis Ativos</span>
                <span className="text-[9px] text-zinc-600 block">{properties.length}/{maxProps} limite</span>
              </div>
              <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
                <MessageSquare className="w-4 h-4 text-emerald-400 mb-2" />
                <span className="text-xl font-bold text-white block">{conversations.filter(c => c.status === 'active').length}</span>
                <span className="text-[10px] text-zinc-500">Conversas Ativas</span>
              </div>
              <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
                <Compass className="w-4 h-4 text-cyan-400 mb-2" />
                <span className="text-xl font-bold text-white block">{totalRegionalPois}</span>
                <span className="text-[10px] text-zinc-500">POIs Regionais</span>
              </div>
              <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
                <Search className="w-4 h-4 text-blue-400 mb-2" />
                <span className="text-xl font-bold text-white block">{conversations.filter(c => c.mode === 'pre_booking').length}</span>
                <span className="text-[10px] text-zinc-500">Pré-reserva</span>
              </div>
              <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-4">
                <Shield className="w-4 h-4 text-amber-400 mb-2" />
                <span className="text-xl font-bold text-white block">{conversations.filter(c => c.mode === 'post_booking').length}</span>
                <span className="text-[10px] text-zinc-500">Pós-reserva</span>
              </div>
            </div>

            {/* What Zélla AirB Does */}
            <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#FF5A5F]" />
                O que o Zélla AirB faz por você
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Responde no WhatsApp</span>
                    <span className="text-[10px] text-zinc-500">Como o dono que sabe tudo — tom pessoal, íntimo</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <Eye className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Detecta pré/pós-reserva</span>
                    <span className="text-[10px] text-zinc-500">Automaticamente muda o comportamento da IA</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Magic Onboarding</span>
                    <span className="text-[10px] text-zinc-500">Cole o link do Airbnb e preenchemos ~78% do cadastro</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <Compass className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Conhecimento Regional</span>
                    <span className="text-[10px] text-zinc-500">Descobre praias, farmácias, restaurantes próximos automaticamente</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">One-Shot Resolution</span>
                    <span className="text-[10px] text-zinc-500">Resposta densa e completa para minimizar custos</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <Edit3 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Conhecimento do Anfitrião</span>
                    <span className="text-[10px] text-zinc-500">Adicione dicas que a IA usa para responder hóspedes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Info with CTA */}
            <div className="bg-[#121216]/60 border border-white/[0.04] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Seu Plano Zélla AirB
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${currentPlan === 'max' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {planLabel}
                </div>
                <div className="text-xs text-zinc-400 space-y-0.5">
                  <div>
                    <span className="text-white font-bold">{properties.length}/{maxProps}</span> imóveis
                  </div>
                  <div>
                    <span className="text-white font-bold">{totalRegionalPois}</span> POIs regionais
                  </div>
                  <div>
                    <span className="text-white font-bold">{conversations.filter(c => c.status === 'active').length}</span> conversas ativas
                  </div>
                </div>
                {currentPlan !== 'max' && (
                  <div className="sm:ml-auto">
                    <Button variant="outline" size="sm" onClick={onUpgrade} className="text-[10px] border-amber-500/20 text-amber-400 hover:bg-amber-500/10 gap-1.5">
                      <TrendingUp className="w-3 h-3" />
                      {currentPlan === 'pro' ? 'Upgrade MAX →' : 'Upgrade PRO →'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PROPERTIES ─────────────────────────────────────── */}
        {activeSubTab === 'properties' && (
          <motion.div key="properties" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Property Detail View */}
            {selectedProperty ? (
              <PropertyDetailView
                property={selectedProperty}
                regionalPois={regionalPois}
                regionalLoading={regionalLoading}
                onBack={handleBackFromDetails}
                onDelete={(id) => { handleDeleteProperty(id); handleBackFromDetails(); }}
                onHostKnowledgeSave={(items) => handleHostKnowledgeSave(selectedProperty.id, items)}
              />
            ) : (
              <>
                {/* Add Property Form */}
                {showAddForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-[#121216]/80 border border-[#FF5A5F]/10 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#FF5A5F]" />
                        Cadastrar Imóvel Airbnb
                      </h3>
                      <button onClick={() => { setShowAddForm(false); setScrapedRegionalKnowledge([]); setScrapeStep(-1); }} className="p-1 hover:bg-white/[0.04] rounded text-zinc-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Nome do Imóvel</Label>
                        <Input value={newProperty.name} onChange={(e) => setNewProperty(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Apartamento Vista Mar" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">ID Airbnb</Label>
                        <Input value={newProperty.airbnbId} onChange={(e) => setNewProperty(p => ({ ...p, airbnbId: e.target.value }))} placeholder="18584298" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">URL Airbnb</Label>
                        <Input value={newProperty.airbnbUrl} onChange={(e) => setNewProperty(p => ({ ...p, airbnbUrl: e.target.value }))} placeholder="https://www.airbnb.com.br/rooms/..." className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Cidade</Label>
                        <Input value={newProperty.city} onChange={(e) => setNewProperty(p => ({ ...p, city: e.target.value }))} placeholder="Florianópolis" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Estado</Label>
                        <Input value={newProperty.state} onChange={(e) => setNewProperty(p => ({ ...p, state: e.target.value }))} placeholder="SC" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Tipo</Label>
                        <select value={newProperty.propertyType} onChange={(e) => setNewProperty(p => ({ ...p, propertyType: e.target.value }))} className="w-full h-9 px-3 rounded-md bg-[#0a0a0f] border border-white/[0.06] text-white text-xs">
                          {Object.entries(PROPERTY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Quartos</Label>
                        <Input type="number" value={newProperty.bedrooms} onChange={(e) => setNewProperty(p => ({ ...p, bedrooms: e.target.value }))} className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Banheiros</Label>
                        <Input type="number" value={newProperty.bathrooms} onChange={(e) => setNewProperty(p => ({ ...p, bathrooms: e.target.value }))} className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Hóspedes Máx.</Label>
                        <Input type="number" value={newProperty.maxGuests} onChange={(e) => setNewProperty(p => ({ ...p, maxGuests: e.target.value }))} className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Preço/Noite (R$)</Label>
                        <Input type="number" value={newProperty.pricePerNight} onChange={(e) => setNewProperty(p => ({ ...p, pricePerNight: e.target.value }))} placeholder="350" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">WiFi Nome</Label>
                        <Input value={newProperty.wifiName} onChange={(e) => setNewProperty(p => ({ ...p, wifiName: e.target.value }))} placeholder="MinhaRede_5G" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">WiFi Senha</Label>
                        <Input value={newProperty.wifiPassword} onChange={(e) => setNewProperty(p => ({ ...p, wifiPassword: e.target.value }))} placeholder="senha123" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Check-in</Label>
                        <Input value={newProperty.checkinTime} onChange={(e) => setNewProperty(p => ({ ...p, checkinTime: e.target.value }))} placeholder="15:00" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Check-out</Label>
                        <Input value={newProperty.checkoutTime} onChange={(e) => setNewProperty(p => ({ ...p, checkoutTime: e.target.value }))} placeholder="11:00" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Fechadura Inteligente</Label>
                        <Input value={newProperty.lockProvider} onChange={(e) => setNewProperty(p => ({ ...p, lockProvider: e.target.value }))} placeholder="Igloohome / Nuki" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-zinc-400 mb-1 block">Código da Fechadura</Label>
                        <Input value={newProperty.lockCode} onChange={(e) => setNewProperty(p => ({ ...p, lockCode: e.target.value }))} placeholder="1234#" className="bg-[#0a0a0f] border-white/[0.06] text-white text-xs" />
                      </div>
                    </div>

                    {/* Show regional knowledge that will be saved */}
                    {scrapedRegionalKnowledge.length > 0 && (
                      <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Compass className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-[10px] font-bold text-white">Salvar Conhecimento Regional</span>
                          <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                            {scrapedRegionalKnowledge.length} POIs
                          </Badge>
                        </div>
                        <p className="text-[9px] text-zinc-500 mb-2">Os seguintes POIs serão salvos automaticamente junto com o imóvel:</p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                          {scrapedRegionalKnowledge.map((poi, idx) => {
                            const config = POI_CATEGORY_CONFIG[poi.category] || POI_CATEGORY_CONFIG.other;
                            const Icon = config.icon;
                            return (
                              <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.03] border border-white/[0.05] rounded text-[9px]">
                                <Icon className={`w-2.5 h-2.5 ${config.color}`} />
                                <span className="text-zinc-400">{poi.name}</span>
                                {poi.distance != null && <span className="text-zinc-600">({poi.distance}km)</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
                      <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setScrapedRegionalKnowledge([]); setScrapeStep(-1); }} className="text-xs border-white/[0.08] text-zinc-400">
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleCreateProperty} disabled={!newProperty.name.trim()} className="bg-[#FF5A5F] hover:bg-[#FF5A5F]/80 text-white text-xs font-bold gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Cadastrar Imóvel
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Properties Grid */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  </div>
                ) : properties.length === 0 ? (
                  <div className="text-center py-12 bg-[#121216]/40 border border-white/[0.03] rounded-xl">
                    <Home className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400 font-bold">Nenhum imóvel Airbnb cadastrado</p>
                    <p className="text-xs text-zinc-600 mt-1">Use o Magic Onboarding acima para cadastrar seu primeiro imóvel.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {properties.map((prop) => (
                      <PropertyCard key={prop.id} property={prop} onDelete={handleDeleteProperty} onViewDetails={handleViewDetails} />
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── CONVERSATIONS ──────────────────────────────────── */}
        {activeSubTab === 'conversations' && (
          <motion.div key="conversations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* Conversation stats bar */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-zinc-400">Airbnb: <span className="text-white font-bold">{conversations.filter(c => c.platformContext?.startsWith('airbnb')).length}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-zinc-400">WhatsApp: <span className="text-white font-bold">{conversations.filter(c => c.platformContext === 'whatsapp').length}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-zinc-400">Direto: <span className="text-white font-bold">{conversations.filter(c => c.platformContext === 'direct').length}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] ml-auto">
                <span className="text-zinc-500">Pré-reserva: <span className="text-blue-400 font-bold">{conversations.filter(c => c.mode === 'pre_booking').length}</span></span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-500">Pós-reserva: <span className="text-emerald-400 font-bold">{conversations.filter(c => c.mode === 'post_booking').length}</span></span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 bg-[#121216]/40 border border-white/[0.03] rounded-xl">
                <MessageSquare className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-400 font-bold">Nenhuma conversa ainda</p>
                <p className="text-xs text-zinc-600 mt-1">Quando hóspedes enviarem mensagens no WhatsApp, aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                {conversations.map((conv) => (
                  <ConversationRow key={conv.id} conversation={conv} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── AIRB PRO (Relatórios, Financeiro, Operações, Metas, Comissões) ── */}
        {activeSubTab === 'pro' && (
          <motion.div key="pro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AirBProPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
