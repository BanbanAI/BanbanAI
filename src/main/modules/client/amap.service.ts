import axios from "axios";
import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";

type AmapCoordinateConvertResponse = {
  status?: string;
  info?: string;
  infocode?: string;
  locations?: string;
};

type AmapRegeoResponse = {
  status?: string;
  info?: string;
  infocode?: string;
  regeocode?: {
    formatted_address?: string;
  };
};

@Injectable()
export class AmapService {
  async reverseGeocode(location: string, mapKey: string) {
    const normalizedLocation = this.normalizeLocation(location);
    const normalizedMapKey = mapKey?.trim();

    if (!normalizedMapKey) {
      throw new BadRequestException("missing amap key");
    }

    const amapLocation = await this.convertCoordinate(normalizedLocation, normalizedMapKey);
    const regeocode = await this.fetchReverseGeocode(amapLocation, normalizedMapKey);

    return {
      formattedAddress: regeocode.formattedAddress,
      amapLocation,
      location: normalizedLocation,
      regeocode: regeocode.raw,
    };
  }

  private normalizeLocation(location: string) {
    const normalizedLocation = location?.trim();
    if (!normalizedLocation) {
      throw new BadRequestException("missing location");
    }

    const [longitude, latitude] = normalizedLocation.split(",");
    if (!longitude || !latitude || Number.isNaN(Number(longitude)) || Number.isNaN(Number(latitude))) {
      throw new BadRequestException("invalid location");
    }

    return `${Number(longitude)},${Number(latitude)}`;
  }

  private async convertCoordinate(location: string, mapKey: string) {
    const { data } = await axios.get<AmapCoordinateConvertResponse>(
      "https://restapi.amap.com/v3/assistant/coordinate/convert",
      {
        params: {
          locations: location,
          coordsys: "gps",
          output: "json",
          key: mapKey,
        },
        timeout: 10000,
      },
    );

    if (data?.status !== "1" || !data.locations) {
      throw new BadGatewayException(data?.info || "amap coordinate conversion failed");
    }

    return data.locations;
  }

  private async fetchReverseGeocode(amapLocation: string, mapKey: string) {
    const { data } = await axios.get<AmapRegeoResponse>(
      "https://restapi.amap.com/v3/geocode/regeo",
      {
        params: {
          key: mapKey,
          location: amapLocation,
          radius: 1000,
          extensions: "all",
        },
        timeout: 10000,
      },
    );

    const formattedAddress = data?.regeocode?.formatted_address?.trim();
    if (data?.status !== "1" || !formattedAddress) {
      throw new BadGatewayException(data?.info || "amap reverse geocode failed");
    }

    return {
      formattedAddress,
      raw: data.regeocode,
    };
  }
}
