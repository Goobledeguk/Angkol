import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { ps } from "../passenger/passengerStyles";
import { initials } from "./initials";

export default function DriverAvatar({
  photo,
  name,
  size = 60,
}: {
  photo?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | undefined>();
  return (
    <View
      style={[
        ps.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
        },
      ]}
    >
      {photo?.startsWith("data:image/") && failed !== photo ? (
        <Image
          accessibilityLabel={`${name}'s driver photo`}
          source={{ uri: photo }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(photo)}
        />
      ) : (
        <Text style={ps.avatarText}>{initials(name)}</Text>
      )}
    </View>
  );
}
