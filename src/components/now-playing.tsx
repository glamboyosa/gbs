import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FastAverageColor } from "fast-average-color";
import { generateRandomValues } from "@/lib/utils";
import useSWR from "swr";
import type { SpotifyData } from "@/lib/types";



const fac = new FastAverageColor();

export function NowPlaying() {
  const [color, setColor] = useState("#E2E8F0");
  const [frequencies, setFrequencies] = useState<number[]>(generateRandomValues(6));
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: song } = useSWR<SpotifyData & { progress_ms: number }>(
    '/api/now-playing',
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    {
      refreshInterval: 1000,
    }
  );

  const getColor = async (img: HTMLImageElement) => {
    try {
      const c = await fac.getColorAsync(img, {
        mode: "precision",
      });
      setColor(c.hex);
    } catch (error) {
      console.log(error);
      setColor("#E2E8F0");
    }
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (song?.isPlaying) {
        setFrequencies(generateRandomValues(6));
      }
    }, 300);

    return () => clearInterval(intervalId);
  }, [song?.isPlaying]);

  if (!song) return null;

  return (
    <motion.div
      layout
      style={{ borderRadius: 9999 }}
      onClick={() => setIsExpanded(!isExpanded)}
      className="h-fit min-w-[100px] overflow-hidden bg-black cursor-pointer"
    >
      <motion.div
        className="relative h-7 px-2.5"
        initial={{ width: 128 }}
        animate={{ width: isExpanded ? 300 : 128, height: isExpanded ? 400 : 28 }}
        transition={{ type: "spring", bounce: 0.5, stiffness: 300, damping: 30 }}
      >
        <div className="relative flex h-7 items-center justify-between px-2.5">
          <img
            src={song.albumImageUrl || "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36"}
            alt={song.title || "Album Art"}
            width={20}
            height={20}
            onLoad={(e) => getColor(e.target as HTMLImageElement)}
            className="rounded-sm"
          />
          <div className="ml-auto flex items-center">
            {frequencies.map((value, index) => (
              <motion.div
                layout
                className="mx-[1px] w-[1px] rounded-md"
                key={`${index}-${value}`}
                style={{
                  backgroundColor: color,
                }}
                initial={{
                  width: 2,
                  height: song.isPlaying ? value : 0,
                  scaleY: 0.75,
                }}
                transition={{
                  duration: 0.1,
                  type: "spring",
                  bounce: 0.6,
                }}
              />
            ))}
          </div>
        </div>
        {isExpanded && (
          <div className="p-4 text-white">
            <p className="font-medium">{song.title}</p>
            <p className="text-sm text-gray-400">{song.artist}</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
