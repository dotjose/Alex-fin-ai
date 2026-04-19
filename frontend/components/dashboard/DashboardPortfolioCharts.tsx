/**
 * @deprecated Import chart panels + `useDashboardChartModel` from their modules.
 * Kept as a thin barrel for any legacy imports.
 */
export { useDashboardChartModel } from "@/lib/useDashboardChartModel";
export {
  DashboardAllocationPanel,
  DashboardAssetPulseRow,
  DashboardExposurePanel,
  DashboardHistoryPanel,
  DashboardSparkPanel,
} from "./DashboardChartPanels";
