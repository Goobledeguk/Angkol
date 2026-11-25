import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { initials } from "./initials";
import { passengerColors as c } from "../passenger/passengerStyles";

/** Profile circle: the uploaded photo when it loads, otherwise the user's initials. */
export default function Avatar({
  photo,
  name,
  size = 52,
}: {
  photo?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | undefined>();
  const usable = !!photo && /^(data:image\/|https?:)/i.test(photo) && failed !== photo;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.brandSoft,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {usable ? (
        <Image
          accessibilityLabel={`${name}'s profile photo`}
          source={{ uri: photo }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(photo)}
        />
      ) : (
        <Text
          accessibilityLabel={`${name}'s initials`}
          style={{
            fontFamily: "Archivo",
            fontWeight: "700",
            fontSize: Math.max(12, Math.round(size * 0.38)),
            color: c.brand,
          }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
