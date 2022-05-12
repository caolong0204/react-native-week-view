import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  ScrollView,
  Animated,
  VirtualizedList,
  ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import moment from 'moment';
import memoizeOne from 'memoize-one';

import Event from '../Event/Event';
import Events from '../Events/Events';
import Times from '../Times/Times';
import styles from './WeekView.styles';
import {
  DATE_STR_FORMAT,
  availableNumberOfDays,
  setLocale,
  minutesToYDimension,
  computeWeekViewDimensions,
} from '../utils';

const MINUTES_IN_DAY = 60 * 24;
const calculateTimesArray = (
  minutesStep,
  formatTimeLabel,
  beginAt = 0,
  endAt = MINUTES_IN_DAY,
) => {
  const times = [];
  const startOfDay = moment().startOf('day');
  for (
    let timer = 0 <= beginAt && beginAt < MINUTES_IN_DAY ? beginAt : 0;
    timer < endAt && timer < MINUTES_IN_DAY;
    timer += minutesStep
  ) {
    const time = startOfDay.clone().minutes(timer);
    times.push(time.format(formatTimeLabel));
  }

  return times;
};

export default class WeekView extends Component {
  constructor(props) {
    super(props);
    this.eventsGrid = null;
    this.verticalAgenda = null;
    this.header = null;
    this.pageOffset = 2;
    this.currentPageIndex = this.pageOffset;
    this.eventsGridScrollX = new Animated.Value(0);

    const initialDates = this.calculatePagesDates(
      props.selectedDate,
      props.numberOfDays,
      props.weekStartsOn,
      props.prependMostRecent,
      props.fixedHorizontally,
    );
    this.state = {
      // currentMoment should always be the first date of the current page
      currentMoment: moment(initialDates[this.currentPageIndex]).toDate(),
      initialDates,
    };

    setLocale(props.locale);
  }

  componentDidMount() {
    requestAnimationFrame(() => {
      this.scrollToVerticalStart();
    });
    this.eventsGridScrollX.addListener((position) => {
      // this.header.scrollToOffset({ offset: position.value, animated: false });
    });
  }

  componentDidUpdate(prevProps) {
    if (this.props.locale !== prevProps.locale) {
      setLocale(this.props.locale);
    }
    if (this.props.numberOfDays !== prevProps.numberOfDays) {
      const initialDates = this.calculatePagesDates(
        this.state.currentMoment,
        this.props.numberOfDays,
        this.props.prependMostRecent,
        this.props.fixedHorizontally,
      );

      this.currentPageIndex = this.pageOffset;
      this.setState(
        {
          currentMoment: moment(initialDates[this.currentPageIndex]).toDate(),
          initialDates,
        },
        () => {
          this.eventsGrid.scrollToIndex({
            index: this.pageOffset,
            animated: false,
          });
        },
      );
    }
  }

  componentWillUnmount() {
    this.eventsGridScrollX.removeAllListeners();
  }

  calculateTimes = memoizeOne(calculateTimesArray);

  scrollToVerticalStart = () => {
    if (this.verticalAgenda) {
      const { startHour, hoursInDisplay, beginAgendaAt } = this.props;
      const startHeight = minutesToYDimension(hoursInDisplay, startHour * 60);
      const agendaOffset = minutesToYDimension(hoursInDisplay, beginAgendaAt);
      this.verticalAgenda.scrollTo({
        y: startHeight - agendaOffset,
        x: 0,
        animated: false,
      });
    }
  };

  getSignToTheFuture = () => {
    const { prependMostRecent } = this.props;

    const daySignToTheFuture = prependMostRecent ? -1 : 1;
    return daySignToTheFuture;
  };

  prependPagesInPlace = (initialDates, nPages) => {
    const { numberOfDays } = this.props;
    const daySignToTheFuture = this.getSignToTheFuture();

    const first = initialDates[0];
    const daySignToThePast = daySignToTheFuture * -1;
    const addDays = numberOfDays * daySignToThePast;
    for (let i = 1; i <= nPages; i += 1) {
      const initialDate = moment(first).add(addDays * i, 'd');
      initialDates.unshift(initialDate.format(DATE_STR_FORMAT));
    }
  };

  appendPagesInPlace = (initialDates, nPages) => {
    const { numberOfDays } = this.props;
    const daySignToTheFuture = this.getSignToTheFuture();

    const latest = initialDates[initialDates.length - 1];
    const addDays = numberOfDays * daySignToTheFuture;
    for (let i = 1; i <= nPages; i += 1) {
      const initialDate = moment(latest).add(addDays * i, 'd');
      initialDates.push(initialDate.format(DATE_STR_FORMAT));
    }
  };

  goToDate = (targetDate, animated = true) => {
    const { initialDates } = this.state;
    const { numberOfDays } = this.props;

    const currentDate = moment(initialDates[this.currentPageIndex]).startOf(
      'day',
    );
    const deltaDay = moment(targetDate).startOf('day').diff(currentDate, 'day');
    const deltaIndex = Math.floor(deltaDay / numberOfDays);
    const signToTheFuture = this.getSignToTheFuture();
    const targetIndex = this.currentPageIndex + deltaIndex * signToTheFuture;

    this.goToPageIndex(targetIndex, animated);
  };

  goToPageIndex = (target, animated = true) => {
    if (target === this.currentPageIndex) {
      return;
    }

    const { initialDates } = this.state;

    const scrollTo = (moveToIndex) => {
      this.eventsGrid.scrollToIndex({
        index: moveToIndex,
        animated,
      });
      this.currentPageIndex = moveToIndex;
    };

    const newState = {};
    let newStateCallback = () => {};
    // The final target may change, if pages are added
    let targetIndex = target;

    const lastViewablePage = initialDates.length - this.pageOffset;
    if (targetIndex < this.pageOffset) {
      const nPages = this.pageOffset - targetIndex;
      this.prependPagesInPlace(initialDates, nPages);

      targetIndex = this.pageOffset;

      newState.initialDates = [...initialDates];
      newStateCallback = () => setTimeout(() => scrollTo(targetIndex), 0);
    } else if (targetIndex > lastViewablePage) {
      const nPages = targetIndex - lastViewablePage;
      this.appendPagesInPlace(initialDates, nPages);

      targetIndex = initialDates.length - this.pageOffset;

      newState.initialDates = [...initialDates];
      newStateCallback = () => setTimeout(() => scrollTo(targetIndex), 0);
    } else {
      scrollTo(targetIndex);
    }

    newState.currentMoment = moment(initialDates[targetIndex]).toDate();
    this.setState(newState, newStateCallback);
  };

  eventsGridRef = (ref) => {
    this.eventsGrid = ref;
  };

  verticalAgendaRef = (ref) => {
    this.verticalAgenda = ref;
  };

  headerRef = (ref) => {
    this.header = ref;
  };

  calculatePagesDates = (
    currentMoment,
    numberOfDays,
    weekStartsOn,
    prependMostRecent,
    fixedHorizontally,
  ) => {
    const initialDates = [];
    const centralDate = moment(currentMoment);
    if (numberOfDays === 7 || fixedHorizontally) {
      centralDate.subtract(
        // Ensure centralDate is before currentMoment
        (centralDate.day() + 7 - weekStartsOn) % 7,
        'days',
      );
    }
    for (let i = -this.pageOffset; i <= this.pageOffset; i += 1) {
      const initialDate = moment(centralDate).add(numberOfDays * i, 'd');
      initialDates.push(initialDate.format(DATE_STR_FORMAT));
    }
    return prependMostRecent ? initialDates.reverse() : initialDates;
  };

  sortEventsByDate = memoizeOne((events) => {
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
  });

  updateDimensions = memoizeOne(computeWeekViewDimensions);

  getListItemLayout = (item, index) => {
    const pageWidth = this.dimensions.pageWidth || 0;
    return {
      length: pageWidth,
      offset: pageWidth * index,
      index,
    };
  };

  render() {
    const {
      numberOfDays,
      hourTextStyle,
      gridRowStyle,
      gridColumnStyle,
      eventContainerStyle,
      onEventPress,
      onEventLongPress,
      events,
      hoursInDisplay,
      timeStep,
      beginAgendaAt,
      endAgendaAt,
      formatTimeLabel,
      onGridClick,
      onGridLongPress,
      EventComponent,
      rightToLeft,
      showNowLine,
      nowLineColor,
      onDragEvent,
      isRefreshing,
      RefreshComponent,
    } = this.props;
    const { initialDates } = this.state;
    const times = this.calculateTimes(
      timeStep,
      formatTimeLabel,
      beginAgendaAt,
      endAgendaAt,
    );
    const eventsByDate = this.sortEventsByDate(events);

    this.dimensions = this.updateDimensions(numberOfDays);
    const { pageWidth, dayWidth, timeLabelsWidth } = this.dimensions;

    return (
      <GestureHandlerRootView style={styles.container}>
        {isRefreshing && RefreshComponent && (
          <RefreshComponent
            style={[styles.loadingSpinner, { right: pageWidth / 2 }]}
          />
        )}
        <ScrollView
          onStartShouldSetResponderCapture={() => false}
          onMoveShouldSetResponderCapture={() => false}
          onResponderTerminationRequest={() => false}
          ref={this.verticalAgendaRef}
        >
          <View style={styles.scrollViewContent}>
            <Times
              times={times}
              textStyle={hourTextStyle}
              hoursInDisplay={hoursInDisplay}
              timeStep={timeStep}
              width={timeLabelsWidth}
            />
            <VirtualizedList
              data={initialDates}
              getItem={(data, index) => data[index]}
              getItemCount={(data) => data.length}
              getItemLayout={this.getListItemLayout}
              keyExtractor={(item) => item}
              initialScrollIndex={this.pageOffset}
              scrollEnabled={false}
              onStartShouldSetResponderCapture={() => false}
              onMoveShouldSetResponderCapture={() => false}
              onResponderTerminationRequest={() => false}
              renderItem={({ item }) => {
                return (
                  <Events
                    times={times}
                    eventsByDate={eventsByDate}
                    initialDate={item}
                    numberOfDays={numberOfDays}
                    onEventPress={onEventPress}
                    onEventLongPress={onEventLongPress}
                    onGridClick={onGridClick}
                    onGridLongPress={onGridLongPress}
                    hoursInDisplay={hoursInDisplay}
                    timeStep={timeStep}
                    beginAgendaAt={beginAgendaAt}
                    EventComponent={EventComponent}
                    eventContainerStyle={eventContainerStyle}
                    gridRowStyle={gridRowStyle}
                    gridColumnStyle={gridColumnStyle}
                    rightToLeft={rightToLeft}
                    showNowLine={showNowLine}
                    nowLineColor={nowLineColor}
                    onDragEvent={onDragEvent}
                    pageWidth={pageWidth}
                    dayWidth={dayWidth}
                  />
                );
              }}
              horizontal
              ref={this.eventsGridRef}
            />
          </View>
        </ScrollView>
      </GestureHandlerRootView>
    );
  }
}

WeekView.propTypes = {
  events: PropTypes.arrayOf(Event.propTypes.event),
  formatDateHeader: PropTypes.string,
  numberOfDays: PropTypes.oneOf(availableNumberOfDays).isRequired,
  weekStartsOn: PropTypes.number,
  onSwipeNext: PropTypes.func,
  onSwipePrev: PropTypes.func,
  onEventPress: PropTypes.func,
  onEventLongPress: PropTypes.func,
  onGridClick: PropTypes.func,
  onGridLongPress: PropTypes.func,
  headerStyle: PropTypes.object,
  headerTextStyle: PropTypes.object,
  hourTextStyle: PropTypes.object,
  eventContainerStyle: PropTypes.object,
  gridRowStyle: Events.propTypes.gridRowStyle,
  gridColumnStyle: Events.propTypes.gridColumnStyle,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  locale: PropTypes.string,
  hoursInDisplay: PropTypes.number,
  timeStep: PropTypes.number,
  beginAgendaAt: PropTypes.number,
  endAgendaAt: PropTypes.number,
  formatTimeLabel: PropTypes.string,
  startHour: PropTypes.number,
  EventComponent: PropTypes.elementType,
  DayHeaderComponent: PropTypes.elementType,
  TodayHeaderComponent: PropTypes.elementType,
  showTitle: PropTypes.bool,
  rightToLeft: PropTypes.bool,
  fixedHorizontally: PropTypes.bool,
  prependMostRecent: PropTypes.bool,
  showNowLine: PropTypes.bool,
  nowLineColor: PropTypes.string,
  onDragEvent: PropTypes.func,
  onMonthPress: PropTypes.func,
  onDayPress: PropTypes.func,
  isRefreshing: PropTypes.bool,
  RefreshComponent: PropTypes.elementType,
};

WeekView.defaultProps = {
  events: [],
  locale: 'en',
  hoursInDisplay: 6,
  weekStartsOn: 1,
  timeStep: 60,
  beginAgendaAt: 0,
  endAgendaAt: MINUTES_IN_DAY,
  formatTimeLabel: 'H:mm',
  startHour: 8,
  showTitle: true,
  rightToLeft: false,
  prependMostRecent: false,
  RefreshComponent: ActivityIndicator,
};
