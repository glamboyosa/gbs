import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FastAverageColor } from "fast-average-color";
import { generateRandomValues, getValidToken } from "@/lib/utils";
import useSWR from "swr";
import type { SpotifyData } from "@/lib/types";

const fac = new FastAverageColor();

async function fetchNowPlaying(): Promise<SpotifyData & { progress_ms: number }> {
  const access_token = await getValidToken();
  
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (response.status === 204 || response.status > 400) {
    return {
      isPlaying: false,
      title: '',
      artist: '',
      albumImageUrl: '',
      progress_ms: 0
    };
  }

  const data = await response.json();
  return {
    isPlaying: data.is_playing,
    title: data.item?.name,
    artist: data.item?.artists[0]?.name,
    albumImageUrl: data.item?.album?.images[0]?.url,
    progress_ms: data.progress_ms
  };
}

export function NowPlaying() {
  const [color, setColor] = useState("#E2E8F0");
  const [frequencies, setFrequencies] = useState<number[]>(generateRandomValues(6));
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: song } = useSWR<SpotifyData & { progress_ms: number }>(
    'spotify-now-playing',
    fetchNowPlaying,
    {
      refreshInterval: 1000,
      revalidateOnFocus: false,
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
      className="h-fit max-w-[350px] overflow-hidden bg-black cursor-pointer"
    >
      <motion.div
        className="relative h-7 px-2.5"
        initial={{ height: 28, width: 128 }}
        animate={{    height: isExpanded ? 80 : 28, 
            width: isExpanded ? 320 : 128,
            borderRadius: isExpanded ? 24 : 14 }}
        transition={{ type: "spring", bounce: 0.5, stiffness: 300, damping: 30 }}
      >
        <div className="relative flex items-center justify-between">
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
         <AnimatePresence>
             <div className="p-4 text-white">
            <p className="font-medium">{song.title}</p>
            <p className="text-sm text-gray-400">{song.artist}</p>
          </div>
         </AnimatePresence>
        )}
      </motion.div>
    </motion.div>
  );
}
