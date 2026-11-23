type OreStop = {
  id: string;
  city: string;
  country: string;
  coordinates: [number, number];
  photos: number[];
  clips: number[];
};

export const oreStops: OreStop[] = [
  { id: "accra", city: "Accra", country: "Ghana", coordinates: [-0.1969, 5.6037], photos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 30], clips: [1] },
  { id: "sharm", city: "Sharm El Sheikh", country: "Egypt", coordinates: [34.3299, 27.9158], photos: [20, 25, 26], clips: [2, 3, 5] },
  { id: "hurghada", city: "Hurghada", country: "Egypt", coordinates: [33.8116, 27.2579], photos: [21, 27, 28, 29, 39], clips: [] },
  { id: "toronto", city: "Toronto", country: "Canada", coordinates: [-79.3832, 43.6532], photos: [31, 32, 33, 34, 35], clips: [4, 6, 7, 8, 9, 10, 11, 14] },
  { id: "cotonou", city: "Cotonou", country: "Benin", coordinates: [2.4434, 6.3703], photos: [36, 37, 38], clips: [12, 13] },
];

const mediaPath = (index: number) => String(index).padStart(2, "0");

export const oreMedia = [
  ...Array.from({ length: 39 }, (_, position) => {
    const index = position + 1;
    const stop = oreStops.find((item) => item.photos.includes(index));
    return { kind: "photo" as const, index, src: `/ore-travel/photos/${mediaPath(index)}.jpg`, stopId: stop?.id ?? "all" };
  }),
  ...Array.from({ length: 14 }, (_, position) => {
    const index = position + 1;
    const stop = oreStops.find((item) => item.clips.includes(index));
    return { kind: "clip" as const, index, src: `/ore-travel/clips/${mediaPath(index)}.mp4`, poster: `/ore-travel/posters/${mediaPath(index)}.jpg`, stopId: stop?.id ?? "all" };
  }),
];
