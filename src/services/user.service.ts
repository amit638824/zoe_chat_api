import { env } from "../config/env";
import { ConnectedUser } from "../types/chat.types";

interface UserAccessApiResponse {
  success?: boolean;
  data?: ConnectedUser[];
  users?: ConnectedUser[];
  message?: string;
}

export class UserService {
  async getConnectedUsers(
    userId: string,
    userType: string = "VOL"
  ): Promise<ConnectedUser[]> {
    const url = `${env.userAccessApi.url}?api_key=${encodeURIComponent(env.userAccessApi.apiKey)}&action=get_connected_users`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, user_type: userType }),
    });

    if (!response.ok) {
      throw new Error(
        `User access API failed with status ${response.status}`
      );
    }

    const json = (await response.json()) as UserAccessApiResponse | ConnectedUser[];

    if (Array.isArray(json)) {
      return json.map((user) =>
        normalizeUser(user as unknown as Record<string, unknown>)
      );
    }

    const users = json.data || json.users || [];
    return users.map((user) =>
      normalizeUser(user as unknown as Record<string, unknown>)
    );
  }
}

const normalizeUser = (user: Record<string, unknown>): ConnectedUser => ({
  id: String(user.id || user.user_id || ""),
  first_name: (user.first_name as string) ?? null,
  last_name: (user.last_name as string) ?? null,
  email: (user.email as string) ?? null,
  user_type: (user.user_type as string) ?? null,
});

export const userService = new UserService();
