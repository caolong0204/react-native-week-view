import { Dimensions } from 'react-native';
import PropTypes from 'prop-types';
import moment from 'moment';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CONTENT_OFFSET = 16;
export const CONTAINER_HEIGHT = SCREEN_HEIGHT - 60;
export const DATE_STR_FORMAT = 'YYYY-MM-DD';
export const availableNumberOfDays = [1, 3, 5, 7];

const TIMES_WIDTH_PERCENTAGE = 18;
const PAGE_WIDTH_PERCENTAGE = (100 - TIMES_WIDTH_PERCENTAGE) / 100;

export const bucketEventsByDate = (events) => {
  // Stores the events hashed by their date
  // For example: { "2020-02-03": [event1, event2, ...] }
  // If an event spans through multiple days, adds the event multiple times
  const sortedEvents = {};
  events.forEach((event) => {
    // in milliseconds
    const originalDuration =
      event.endDate.getTime() - event.startDate.getTime();
    const startDate = moment(event.startDate);
    const endDate = moment(event.endDate);

    for (
      let date = moment(startDate);
      date.isSameOrBefore(endDate, 'days');
      date.add(1, 'days')
    ) {
      // Calculate actual start and end dates
      const startOfDay = moment(date).startOf('day');
      const endOfDay = moment(date).endOf('day');
      const actualStartDate = moment.max(startDate, startOfDay);
      const actualEndDate = moment.min(endDate, endOfDay);

      // Add to object
      const dateStr = date.format(DATE_STR_FORMAT);
      if (!sortedEvents[dateStr]) {
        sortedEvents[dateStr] = [];
      }
      sortedEvents[dateStr].push({
        ...event,
        startDate: actualStartDate.toDate(),
        endDate: actualEndDate.toDate(),
        originalDuration,
      });
    }
  });
  // For each day, sort the events by the minute (in-place)
  Object.keys(sortedEvents).forEach((date) => {
    sortedEvents[date].sort((a, b) => {
      return moment(a.startDate).diff(b.startDate, 'minutes');
    });
  });
  return sortedEvents;
};

export const computeWeekViewDimensions = (numberOfDays) => {
  const { width: screenWidth } = Dimensions.get('window');

  // Each day must have an equal width (integer pixels)
  const dayWidth = Math.floor(screenWidth * PAGE_WIDTH_PERCENTAGE / numberOfDays);
  const pageWidth = numberOfDays * dayWidth;

  // Fill the full screen
  const timeLabelsWidth = screenWidth - pageWidth;

  const dimensions = {
    pageWidth,
    timeLabelsWidth,
    dayWidth,
  };
  return dimensions;
}

export const minutesToYDimension = (hoursInDisplay, minutes) => {
  const minutesInDisplay = 60 * hoursInDisplay;
  return (minutes * CONTAINER_HEIGHT) / minutesInDisplay;
};

export const getTimeLabelHeight = (hoursInDisplay, minutesStep) => {
  const timeLabelsInDisplay = Math.ceil((hoursInDisplay * 60) / minutesStep);
  return CONTAINER_HEIGHT / timeLabelsInDisplay;
};

export const getFormattedDate = (date, format) => {
  return moment(date).format(format);
};

export const setLocale = (locale) => {
  if (locale) {
    moment.locale(locale);
  }
};

export const addLocale = (locale, obj) => {
  moment.locale(locale, obj);
};

export const getCurrentMonth = (date) => {
  return moment(date).format('MMMM Y');
};

export const calculateDaysArray = (date, numberOfDays, rightToLeft) => {
  const dates = [];
  for (let i = 0; i < numberOfDays; i += 1) {
    const currentDate = moment(date).add(i, 'd');
    dates.push(currentDate);
  }
  return rightToLeft ? dates.reverse() : dates;
};

export const createFixedWeekDate = (day, hours, minutes = 0, seconds = 0) => {
  const date = moment();
  date.isoWeekday(day);
  date.hours(hours);
  date.minutes(minutes);
  date.seconds(seconds);
  return date.toDate();
};

export const stylePropType = PropTypes.oneOfType([
  PropTypes.object,
  PropTypes.array,
]);
