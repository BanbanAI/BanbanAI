import { UserType } from "@common/types/user";
import axios from "axios";
export type UserStoreType = Partial<UserType>

let _fetching = false;

let user = {};
export const userUtil = {
  async fetch() {
    if (_fetching) {
      return user;
    }
    _fetching = true;
    const res = await axios.get("user/data").catch((err) => {
      console.debug("/user/data", err);
    });
    user = {};
    _fetching = false;
    if (res) {
      user = res.data;
      return res.data;
    }
  },

  async logout() {
    const res = await axios.post("/user/logout").catch(err => {
      console.debug("/user/logout", err);
    })
    if (res) {
      return res.data;
    }
  },
}