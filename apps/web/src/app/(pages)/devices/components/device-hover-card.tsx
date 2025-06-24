import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2Icon } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

export const DeviceHoverCard = React.memo(
  function DeviceHoverCard({ deviceId }: { deviceId: string }) {
    const [imgUrl, setImgUrl] = useState('');
    console.log('deviceID', deviceId);
    return (
      <HoverCard
        onOpenChange={async (open) => {
          if (open) {
            fetch(`/api/android/screen/${deviceId}`, {
              method: 'GET',
            })
              .then((res) => res.blob())
              .then((blob) => {
                setImgUrl(URL.createObjectURL(blob));
              });
          }
        }}
      >
        <HoverCardTrigger asChild>
          <Button variant="link">Preview</Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="flex justify-between gap-4">
            {imgUrl ? (
              <img src={imgUrl} alt="screenshot" />
            ) : (
              <Button size="sm" disabled>
                <Loader2Icon className="animate-spin" />
                Loading...
              </Button>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  },
  (prev, next) => prev.deviceId === next.deviceId,
);
