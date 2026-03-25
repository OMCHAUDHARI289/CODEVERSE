import { Outlet } from "react-router-dom";
import { Round3BattleProvider } from "./round3/Round3BattleContext";

export default function Round3Page() {
  return (
    <Round3BattleProvider>
      <Outlet />
    </Round3BattleProvider>
  );
}
