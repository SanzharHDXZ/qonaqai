import { addDays, format } from "date-fns";

const today = new Date();

export interface DailyForecast {
  date: string;
  dayLabel: string;
  predictedOccupancy: number;
  recommendedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  demandScore: number;
  staticPrice: number;
  aiRevenue: number;
  staticRevenue: number;
  event?: string;
}

export interface Competitor {
  name: string;
  avgPrice: number;
  occupancy: number;
  rating: number;
}

export interface Alert {
  id: string;
  type: "surge" | "event" | "risk";
  title: string;
  description: string;
  date: string;
  impact: string;
}

const events: Record<number, string> = {
  3: "Tech Conference",
  7: "City Marathon",
  14: "Music Festival",
  21: "Trade Fair",
};

const seasonalMultiplier = (dayOffset: number): number => {
  const base = 0.65;
  const weekday = addDays(today, dayOffset).getDay();
  const isWeekend = weekday === 0 || weekday === 5 || weekday === 6;
  const eventBoost = events[dayOffset] ? 0.15 : 0;
  const trendBoost = Math.sin(dayOffset / 7) * 0.08;
  return Math.min(0.98, base + (isWeekend ? 0.18 : 0) + eventBoost + trendBoost + Math.random() * 0.08);
};

export const generateForecasts = (totalRooms = 85, basePrice = 120): DailyForecast[] => {
  return Array.from({ length: 30 }, (_, i) => {
    const occ = seasonalMultiplier(i);
    const demandScore = Math.round(occ * 100);
    const priceMultiplier = 1 + (occ - 0.65) * 2.5;
    const recommended = Math.round(basePrice * priceMultiplier);
    const confidence = Math.round(72 + occ * 20 + Math.random() * 5);
    const roomsSold = Math.round(totalRooms * occ);
    return {
      date: format(addDays(today, i), "yyyy-MM-dd"),
      dayLabel: format(addDays(today, i), "MMM dd"),
      predictedOccupancy: Math.round(occ * 100),
      recommendedPrice: recommended,
      minPrice: Math.round(recommended * 0.82),
      maxPrice: Math.round(recommended * 1.25),
      confidence: Math.min(97, confidence),
      demandScore,
      staticPrice: basePrice,
      aiRevenue: roomsSold * recommended,
      staticRevenue: roomsSold * basePrice,
      event: events[i],
    };
  });
};

export const competitors: Competitor[] = [
  { name: "Grand Plaza Hotel", avgPrice: 142, occupancy: 71, rating: 4.3 },
  { name: "City Center Inn", avgPrice: 98, occupancy: 82, rating: 4.0 },
  { name: "Harbor View Suites", avgPrice: 165, occupancy: 64, rating: 4.6 },
];

export const alerts: Alert[] = [
  {
    id: "1",
    type: "surge",
    title: "High demand surge predicted",
    description: "Occupancy expected to exceed 90% in 14 days due to Music Festival. Consider increasing prices by 22%.",
    date: format(addDays(today, 14), "MMM dd"),
    impact: "+22% price opportunity",
  },
  {
    id: "2",
    type: "event",
    title: "Local event detected",
    description: "Tech Conference in 3 days. Historical data shows 18% demand increase during similar events.",
    date: format(addDays(today, 3), "MMM dd"),
    impact: "+18% demand increase",
  },
  {
    id: "3",
    type: "risk",
    title: "Low occupancy risk next week",
    description: "Mid-week occupancy projected at 58%. Consider promotional pricing to maintain 65% target.",
    date: format(addDays(today, 5), "MMM dd"),
    impact: "-7% below target",
  },
];

export const hotelProfile = {
  name: "The Riverside Hotel",
  rooms: 85,
  city: "Barcelona",
  avgOccupancy: 72,
  basePrice: 120,
  currency: "€",
};

export const kpiData = {
  avgOccupancy: 74,
  avgRecommendedPrice: 148,
  avgConfidence: 86,
  projectedRevenue: 378420,
  staticRevenue: 306000,
  revenueLift: 23.7,
};
