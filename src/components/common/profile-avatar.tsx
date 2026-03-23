import { cn } from "@/lib/utils";
import profileImage from "@/assets/profile.svg";
import { useState } from "react";

interface ProfileAvatarProps {
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  alt?: string;
}

export function ProfileAvatar({
  avatarUrl,
  size = 40,
  className,
  alt = "프로필",
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const displayImage = avatarUrl && !imageError ? avatarUrl : profileImage;

  return (
    <div className={cn("overflow-hidden", className)} style={{ width: size, height: size }}>
      <img
        src={displayImage}
        alt={alt}
        className="h-full w-full rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={handleImageError}
      />
    </div>
  );
}
