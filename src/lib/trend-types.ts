export type TrendGender = "all" | "men" | "women" | "unisex";

export interface TrendFilters {
  startYear: number;
  endYear: number;
  house: string;
  gender: TrendGender;
  minimumRating: number;
  minimumVotes: number;
}

export interface TrendShare {
  name: string;
  percentage: number;
}

export interface TrendPeriodSummary {
  startYear: number;
  endYear: number;
  count: number;
  topNotes: TrendShare[];
  topAccords: TrendShare[];
}

export interface TrendSeries {
  name: string;
  values: number[];
}

export interface TrendChart {
  labels: string[];
  series: TrendSeries[];
}

export interface TrendMover {
  name: string;
  currentPercentage: number;
  previousPercentage: number;
  change: number;
}

export interface TrendEra {
  startYear: number;
  endYear: number;
  label: string;
  dominantAccord: string | null;
  dominantPercentage: number;
}

export interface TrendRepresentative {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  slug: string;
  imageUrl?: string;
  sharedStyle: string;
}

export interface TrendExplorerData {
  filters: TrendFilters;
  availableYears: {
    minimum: number;
    maximum: number;
  };
  current: TrendPeriodSummary;
  previous: TrendPeriodSummary;
  noteChart: TrendChart;
  accordChart: TrendChart;
  rising: TrendMover[];
  declining: TrendMover[];
  eras: TrendEra[];
  representatives: TrendRepresentative[];
}
