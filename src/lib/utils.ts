import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const scaledValue = (value: number) => Math.max((value / 100) * 20, 5);

export const generateRandomValues = (numBars: number) => {
  return Array.from({ length: numBars }, () => scaledValue(Math.random() * 100));
};

