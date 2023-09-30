exports.yearWeekIndex =  (date) => {
    let currentDate = date ?? new Date();
    let currentYear = currentDate.getFullYear();
    let startDate = new Date(currentYear, 0, 1);
    let days = Math.floor((currentDate - startDate) /
        (24 * 60 * 60 * 1000));
    
    var weekNumber = Math.ceil(days / 7);
    return currentYear * 100 + weekNumber;
}