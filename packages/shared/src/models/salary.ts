/**
 * Salary shape, shared by jobs (7.13) and profile preferences (7.3).
 *
 * It lives with the models rather than beside the formatters because it is part of the data
 * contract: `Job.salary` and `Profile.preferences.minSalary` are both this type, and both cross
 * the wire. Formatting is per-platform — mobile renders INR lakh notation on a worklet thread,
 * web renders the USD/EUR/AUD the spec publishes (V2 13.2) through a locale-aware layer (8.8).
 */
export type SalaryCurrency = 'USD' | 'EUR' | 'AUD' | 'INR';

export type SalaryRange = {
  min?: number;
  max?: number;
  currency: SalaryCurrency;
  period: 'year' | 'month' | 'hour';
  /** Provider-inferred rather than employer-stated; rendered as a "· est." suffix. */
  estimated?: boolean;
};
