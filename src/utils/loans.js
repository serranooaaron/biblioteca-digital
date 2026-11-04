export const LOAN_DAYS = 14;
const DUE_SOON_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

// El préstamo vence al terminar el día número LOAN_DAYS, sin importar la hora en que se pidió.
export const dueDateFrom = (start = new Date()) => {
  const due = new Date(start);
  due.setDate(due.getDate() + LOAN_DAYS);
  due.setHours(23, 59, 59, 999);
  return due;
};

// Estado del vencimiento de un préstamo. Los préstamos anteriores a esta función no tienen
// dueDate guardado: para ellos se calcula desde la fecha en que se pidieron.
export const loanStatus = (loan, now = new Date()) => {
  const dueDate = loan.dueDate ?? dueDateFrom(loan.createdAt);
  if (loan.returned) return { dueDate, overdue: false, dueSoon: false, dueToday: false };

  // Se comparan días de calendario; redondear absorbe los cambios de horario.
  const daysLeft = Math.round((startOfDay(dueDate) - startOfDay(now)) / DAY_MS);
  return {
    dueDate,
    daysLeft,
    overdueDays: Math.max(0, -daysLeft),
    overdue: daysLeft < 0,
    dueToday: daysLeft === 0,
    dueSoon: daysLeft > 0 && daysLeft <= DUE_SOON_DAYS,
  };
};
