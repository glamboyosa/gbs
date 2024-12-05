import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FastAverageColor } from "fast-average-color";
import { cn, generateRandomValues, getValidToken } from "@/lib/utils";
import useSWR from "swr";
import type { SpotifyData } from "@/lib/types";
import { MouseCursor } from "./cursor";
import { SpotifyLogin } from "./spotify-login";

const fac = new FastAverageColor();

function processLastPlayedTrack(lastTrack: any) {
  return {
    isPlaying: false,
    title: lastTrack?.name ?? '',
    artist: lastTrack?.artists[0]?.name ?? '',
    albumImageUrl: lastTrack?.album?.images[0]?.url ?? '',
    progress_ms: 0
  };
}

async function fetchLastPlayedTrack(accessToken?: string) {
  const lastPlayedResponse = await fetch(
    'https://api.spotify.com/v1/me/player/recently-played?limit=1',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!lastPlayedResponse.ok) {
    if (lastPlayedResponse.status === 204) {
      return processLastPlayedTrack(null);
    }
    return {
      isPlaying: false,
      title: '',
      artist: '',
      albumImageUrl: '',
      progress_ms: 0
    };
  }

  const lastPlayedData = await lastPlayedResponse.json();
  const lastTrack = lastPlayedData.items[0]?.track;
  console.log("data from last played", lastPlayedData);
  return processLastPlayedTrack(lastTrack);
}

async function fetchNowPlaying(accessToken?: string): Promise<SpotifyData & { progress_ms: number }> {
  const access_token = accessToken ?? await getValidToken();
  
  // First try to get currently playing
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (response.status === 204 || response.status > 400) {
    return fetchLastPlayedTrack(access_token);
  }

  const data = await response.json();
    console.log("data from currently playing",data)
  // If not playing, get last played
  if (!data.is_playing) {
    return fetchLastPlayedTrack(access_token);
  }

  // Return currently playing track data
  return {
    isPlaying: data.is_playing,
    title: data.item?.name,
    artist: data.item?.artists[0]?.name,
    albumImageUrl: data.item?.album?.images[0]?.url,
    progress_ms: data.progress_ms
  };
}

export function NowPlaying({accessToken}: {accessToken?: string}) {
  const [color, setColor] = useState("#E2E8F0");
  const [frequencies, setFrequencies] = useState<number[]>(generateRandomValues(6));
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: song } = useSWR<SpotifyData & { progress_ms: number }>(
    accessToken ? 'spotify-now-playing' : null,
    ()=> fetchNowPlaying(accessToken),
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
    }, 230);

    return () => clearInterval(intervalId);
  }, [song?.isPlaying]);

  if (!accessToken) {
    return <SpotifyLogin />;
  }

  if (!song) return null;

  return (
    <motion.div
      layout
      style={{ borderRadius: isExpanded ? 22 : 9999 }}
      onClick={() => setIsExpanded(!isExpanded)}
      className="h-fit max-w-[400px] overflow-hidden bg-black cursor-pointer"
    >
      <MouseCursor />
      <motion.div
        className={cn("relative h-7 px-2.5")}
        initial={{ height: 28, width: 128 }}
        animate={{    height: isExpanded ? 100 : 28, 
            width: isExpanded ? 230 : 128,
            }}
        transition={{ type: "spring", bounce: 0.5, stiffness: 300, damping: 30 }}
      >
       
      
         <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div 
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative mt-3 flex items-center gap-2"
              >
                <motion.img
                  initial={{ filter: "blur(15px)", scale: 2 }}
                  animate={{ filter: "blur(0px)", scale: 1 }}
                  transition={{ 
                    duration: 0.2,
                    delay: 0.1,
                    scale: {
                      type: "spring",
                      damping: 12,
                      stiffness: 200
                    }
                  }}
                  src={song.albumImageUrl || "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36"}
                  alt={song.title || "Album Art"}
                  className={cn("rounded-sm", isExpanded ? "size-10" : "size-5")}
                  onLoad={(e) => {
                    console.log("loaded the image")
                    getColor(e.target as HTMLImageElement)
                  }}
                 
                />
                <div className="flex flex-col gap-0.5 justify-start text-[8px]">
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="text-white"
                  >
                    {song.title}
                  </motion.span>
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: 0.15 }}
                    className="text-gray-50"
                  >
                    {song.artist}
                  </motion.span>
                </div>
                <div className="ml-auto mr-1 flex items-center">
                  {frequencies.map((value, index) => (
                    <motion.div
                      layout
                      className="mx-[1px] w-[3px] rounded-md"
                      key={`${index}-${value}`}
                      style={{
                        backgroundColor: color,
                      }}
                      initial={{
                        width: 2,
                        height: value,
                        scaleY: 0.75,
                      }}
                      animate={{
                        width: 2,
                        height: song.isPlaying ? value : 2,
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
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative mt-3 flex items-center justify-end"
              >
                <motion.img
                  src={song.albumImageUrl || "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36"}
                  alt={song.title || "Album Art"}
                 className={cn("rounded-sm size-6 -mt-1")}
                  layoutId="album-art"
                  onLoad={(e) => getColor(e.target as HTMLImageElement)}
                />
                <div className="ml-auto mr-2 flex items-center">
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
                        height: song.isPlaying ? value : 2,
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
              </motion.div>
            )}
         </AnimatePresence>
       
      </motion.div>
    </motion.div>
  );
}
