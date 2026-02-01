export enum Category {
  Gadgets = 'Gadgets',
  Home = 'Home',
  Travel = 'Travel',
  Courses = 'Courses',
  Personal = 'Personal',
  Others = 'Others'
}

export enum Priority {
  High = 'High',
  Medium = 'Medium',
  Low = 'Low'
}

export enum Status {
  Planned = 'Planned',
  Bought = 'Bought',
  Dropped = 'Dropped'
}

export enum EcommercePlatform {
  Amazon = 'Amazon',
  Flipkart = 'Flipkart',
  Myntra = 'Myntra',
  Ajio = 'Ajio',
  Other = 'Other'
}

export interface WishlistItem {
  id: string;
  name: string;
  category: Category;
  price: number;
  priority: Priority;
  status: Status;
  platform?: string;
  notes?: string;
  link?: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export type SortField = 'price' | 'priority' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface FilterState {
  category: Category | 'All';
  priority: Priority | 'All';
  status: Status | 'All';
}

export type Language = 'en' | 'te';
export type Theme = 'light' | 'dark';
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';