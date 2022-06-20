import React, {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  Children,
  HTMLAttributes,
  ButtonHTMLAttributes,
  ReactElement,
  MouseEvent,
  TouchEvent,
  ReactNode,
  TransitionEvent,
  RefObject,
} from 'react';

type NavDirection = 'forward' | 'backward';

type NavBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { show?: boolean };

type DotsNav = {
  show?: boolean;
  containerProps?: HTMLAttributes<HTMLDivElement>;
  itemBtnProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  activeItemBtnProps?: ButtonHTMLAttributes<HTMLButtonElement>;
};

type VisibleSlidesState = {
  isFirstSlideVisible: boolean;
  isLastSlideVisible: boolean;
  visibleSlides: { slideIndex: number; isFullyVisible: boolean }[];
};

type ReactSimplyCarouselStaticProps = {
  activeSlideIndex: number;
  activeSlideProps?: HTMLAttributes<any>;
  visibleSlideProps?: HTMLAttributes<any>;
  autoplay?: boolean;
  autoplayDirection?: NavDirection;
  backwardBtnProps?: NavBtnProps;
  children?: ReactNode;
  containerProps?: HTMLAttributes<HTMLDivElement>;
  delay?: number;
  disableNavIfAllVisible?: boolean;
  easing?: string;
  forwardBtnProps?: NavBtnProps;
  hideNavIfAllVisible?: boolean;
  innerProps?: HTMLAttributes<HTMLDivElement>;
  itemsListProps?: HTMLAttributes<HTMLDivElement>;
  itemsToScroll?: number;
  itemsToShow?: number;
  onAfterChange?: (
    // eslint-disable-next-line no-unused-vars
    activeSlideIndex: number,
    // eslint-disable-next-line no-unused-vars
    deprecated_positionSlideIndex: number
  ) => void;
  onRequestChange: (
    // eslint-disable-next-line no-unused-vars
    newActiveSlideIndex: number,
    // eslint-disable-next-line no-unused-vars
    newVisibleSlidesState: VisibleSlidesState
  ) => void;
  speed?: number;
  updateOnItemClick?: boolean;
  centerMode?: boolean;
  infinite?: boolean;
  disableNavIfEdgeVisible?: boolean;
  disableNavIfEdgeActive?: boolean;
  dotsNav?: DotsNav;
  persistentChangeCallbacks?: boolean;
  showSlidesBeforeInit?: boolean;
};

type ReactSimplyCarouselResponsiveProps = (Omit<
  Omit<ReactSimplyCarouselStaticProps, 'activeSlideIndex'>,
  'onRequestChange'
> & { minWidth?: number; maxWidth?: number })[];

type ReactSimplyCarouselProps = ReactSimplyCarouselStaticProps & {
  responsiveProps?: ReactSimplyCarouselResponsiveProps;
};

function getSlidesHTMLElements({
  infinite,
  indexOfFirstSlideInDOM,
  itemsListRef,
}: {
  infinite: boolean;
  indexOfFirstSlideInDOM: number;
  itemsListRef: RefObject<HTMLDivElement>;
}) {
  return infinite
    ? ([...itemsListRef.current!.children].slice(
        itemsListRef.current!.children.length / 3 - indexOfFirstSlideInDOM,
        itemsListRef.current!.children.length / 3 -
          indexOfFirstSlideInDOM +
          itemsListRef.current!.children.length / 3
      ) as HTMLElement[])
    : ([...itemsListRef.current!.children] as HTMLElement[]);
}

function getVisibleSidesItems({
  activeSlideIndex,
  itemsListRef,
  innerRef,
  offsetCorrectionForCenterMode,
  offsetCorrectionForInfiniteMode,
  infinite,
  indexOfFirstSlideInDOM,
  itemsToShow,
}: {
  activeSlideIndex: number;
  itemsListRef: RefObject<HTMLDivElement>;
  innerRef: RefObject<HTMLDivElement>;
  offsetCorrectionForCenterMode: number;
  offsetCorrectionForInfiniteMode: number;
  infinite: boolean;
  indexOfFirstSlideInDOM: number;
  itemsToShow: number;
}) {
  const slidesHTMLElements = getSlidesHTMLElements({
    infinite,
    indexOfFirstSlideInDOM,
    itemsListRef,
  });

  const innerMaxWidth = itemsToShow
    ? slidesHTMLElements.reduce((result, item, index) => {
        const isItemVisible =
          (index >= activeSlideIndex &&
            index < activeSlideIndex + itemsToShow) ||
          (index < activeSlideIndex &&
            index < activeSlideIndex + itemsToShow - slidesHTMLElements.length);

        if (!isItemVisible) {
          return result;
        }

        return result + item.offsetWidth;
      }, 0)
    : innerRef.current!.offsetWidth;

  const start = infinite
    ? offsetCorrectionForInfiniteMode + offsetCorrectionForCenterMode
    : Math.min(
        itemsListRef.current!.offsetWidth - innerMaxWidth,
        slidesHTMLElements.reduce((res, item, index) => {
          if (index < activeSlideIndex) {
            return res + item.offsetWidth;
          }

          return res;
        }, 0)
      );
  const end = start + innerMaxWidth;

  const slidesHTMLElementsInRender = infinite
    ? [
        ...slidesHTMLElements
          .slice(activeSlideIndex)
          .map((htmlElement, index) => ({
            slideIndex: index + activeSlideIndex,
            htmlElement,
          })),
        ...slidesHTMLElements.map((htmlElement, index) => ({
          slideIndex: index,
          htmlElement,
        })),
        ...slidesHTMLElements.map((htmlElement, index) => ({
          slideIndex: index,
          htmlElement,
        })),
        ...slidesHTMLElements
          .slice(0, activeSlideIndex)
          .map((htmlElement, index) => ({ slideIndex: index, htmlElement })),
      ]
    : slidesHTMLElements.map((htmlElement, index) => ({
        slideIndex: index,
        htmlElement,
      }));

  const visibilityItemsState = slidesHTMLElementsInRender.reduce(
    (result, { slideIndex, htmlElement }) => {
      const htmlElementWidth = htmlElement.offsetWidth;

      if (
        (result.summ >= start && result.summ < end) ||
        (result.summ + htmlElementWidth > start &&
          result.summ + htmlElementWidth <= end)
      ) {
        result.items.push({
          slideIndex,
          isFullyVisible:
            result.summ + htmlElementWidth <= end && result.summ >= start,
        });
      }

      // eslint-disable-next-line no-param-reassign
      result.summ += htmlElementWidth;

      return result;
    },
    {
      summ: 0,
      items: [] as { slideIndex: number; isFullyVisible: boolean }[],
    }
  );

  const isFirstSlideVisible = !!visibilityItemsState.items.find(
    (item) => item.slideIndex === 0
  );

  const isLastSlideVisible = !!visibilityItemsState.items.find(
    (item) => item.slideIndex === slidesHTMLElements.length - 1
  );

  return {
    visibleSlides: visibilityItemsState.items,
    isFirstSlideVisible,
    isLastSlideVisible,
  };
}

function ReactSimplyCarousel({
  responsiveProps = [],
  ...props
}: ReactSimplyCarouselProps) {
  const [windowWidth, setWindowWidth] = useState(0);
  const [positionIndex, setPositionIndex] = useState(props.activeSlideIndex);

  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const itemsListRef = useRef<HTMLDivElement>(null);

  const itemsListDragStartPosRef = useRef<number>(0);
  const isListDraggingRef = useRef(false);

  const directionRef = useRef('');

  const autoplayTimerRef = useRef<any>(null);
  const resizeTimerRef = useRef<any>(null);

  const renderedSlidesCountRef = useRef(0);
  const firstRenderSlideIndexRef = useRef(positionIndex);

  const propsByWindowWidth = responsiveProps.reduce(
    (result, { minWidth = 0, maxWidth = null, ...item } = {}) => {
      if (windowWidth > minWidth && (!maxWidth || windowWidth <= maxWidth)) {
        return {
          ...result,
          ...item,
        };
      }

      return result;
    },
    props
  );

  const slidesItems = Children.toArray(
    propsByWindowWidth.children
  ) as ReactElement<any>[];

  const {
    containerProps: {
      style: containerStyle = {},
      onClickCapture: containerOnClickCapture = null,
      ...containerProps
    } = {},

    innerProps: { style: innerStyle = {}, ...innerProps } = {},
    itemsListProps: {
      style: itemsListStyle = {},
      onTouchStart: onItemsListTouchStart = null,
      onMouseDown: onItemsListMouseDown = null,
      onTransitionEnd: onItemsListTransitionEnd = null,
      ...itemsListProps
    } = {},
    backwardBtnProps: {
      children: backwardBtnChildren = null,
      show: showBackwardBtn = true,
      ...backwardBtnProps
    } = {},
    forwardBtnProps: {
      children: forwardBtnChildren = null,
      show: showForwardBtn = true,
      ...forwardBtnProps
    } = {},
    activeSlideProps: {
      className: activeSlideClassName = '',
      style: activeSlideStyle = {},
      ...activeSlideProps
    } = {},
    visibleSlideProps: {
      className: visibleSlideClassName = '',
      style: visibleSlideStyle = {},
      ...visibleSlideProps
    } = {},
    updateOnItemClick = false,
    activeSlideIndex,
    onRequestChange,
    speed = 0,
    delay = 0,
    easing = 'linear',
    itemsToShow = 0,
    itemsToScroll = 1,
    children,
    onAfterChange,
    autoplay = false,
    autoplayDirection = 'forward',
    disableNavIfAllVisible = true,
    hideNavIfAllVisible = true,
    centerMode = false,
    infinite = true,
    disableNavIfEdgeVisible = true,
    disableNavIfEdgeActive = true,
    dotsNav = {},
    persistentChangeCallbacks = false,
    // showSlidesBeforeInit = true,
  } = windowWidth
    ? {
        ...propsByWindowWidth,
        activeSlideIndex: Math.max(
          0,
          Math.min(propsByWindowWidth.activeSlideIndex, slidesItems.length - 1)
        ),
        itemsToShow: Math.min(
          slidesItems.length,
          propsByWindowWidth.itemsToShow || 0
        ),
        itemsToScroll: Math.min(
          slidesItems.length,
          propsByWindowWidth.itemsToScroll || 1
        ),
      }
    : props;

  const {
    show: showDotsNav = false,
    containerProps: dotsNavContainerProps = {},
    itemBtnProps: dotsNavBtnProps = {},
    activeItemBtnProps: dotsNavActiveBtnProps = {},
  } = (dotsNav as DotsNav) || {};

  // eslint-disable-next-line no-nested-ternary
  const slidesHTMLElements = !windowWidth
    ? []
    : getSlidesHTMLElements({
        infinite,
        indexOfFirstSlideInDOM: firstRenderSlideIndexRef.current,
        itemsListRef,
      });

  const innerMaxWidth =
    !windowWidth || !itemsToShow
      ? 0
      : slidesHTMLElements.reduce((result, item, index) => {
          const isItemVisible =
            (index >= activeSlideIndex &&
              index < activeSlideIndex + itemsToShow) ||
            (index < activeSlideIndex &&
              index <
                activeSlideIndex + itemsToShow - slidesHTMLElements.length);

          if (!isItemVisible) {
            return result;
          }

          return result + item.offsetWidth;
        }, 0);

  const itemsListMaxTranslateX = windowWidth
    ? itemsListRef.current!.offsetWidth -
      (innerMaxWidth || innerRef.current!.offsetWidth)
    : 0;

  const getItemsListOffsetBySlideIndex = (slideIndex: number) => {
    const offsetByIndex = slidesHTMLElements.reduce((total, item, index) => {
      if (index >= slideIndex) {
        return total;
      }

      return total + (item.offsetWidth || 0);
    }, 0);

    if (infinite) {
      return offsetByIndex;
    }

    return Math.min(itemsListMaxTranslateX, offsetByIndex);
  };

  const lastSlideIndex = Children.count(children) - 1;

  const isAllSlidesVisible = itemsToShow === slidesItems.length;

  const hideNav = hideNavIfAllVisible && isAllSlidesVisible;
  const disableNav = disableNavIfAllVisible && isAllSlidesVisible;

  const isNewSlideIndex = activeSlideIndex - positionIndex !== 0;

  const positionIndexOffset =
    windowWidth && isNewSlideIndex && infinite
      ? getItemsListOffsetBySlideIndex(positionIndex)
      : 0;
  const activeSlideIndexOffset =
    windowWidth && (isNewSlideIndex || !infinite)
      ? getItemsListOffsetBySlideIndex(activeSlideIndex)
      : 0;

  const activeSlideWidth = windowWidth
    ? slidesHTMLElements[activeSlideIndex].offsetWidth
    : 0;

  const isCenterModeEnabled = centerMode && infinite;
  const offsetCorrectionForCenterMode =
    windowWidth && isCenterModeEnabled
      ? -((innerMaxWidth || innerRef.current!.offsetWidth) - activeSlideWidth) /
        2
      : 0;

  const offsetCorrectionForInfiniteMode =
    infinite && windowWidth ? itemsListRef.current!.offsetWidth / 3 : 0;

  const offsetCorrectionForEdgeSlides =
    // eslint-disable-next-line no-nested-ternary
    positionIndex - activeSlideIndex === 0 || !itemsListRef.current
      ? 0
      : // eslint-disable-next-line no-nested-ternary
      directionRef.current.toLowerCase() === 'forward' &&
        activeSlideIndex < positionIndex
      ? offsetCorrectionForInfiniteMode
      : directionRef.current.toLowerCase() === 'backward' &&
        activeSlideIndex > positionIndex
      ? -offsetCorrectionForInfiniteMode
      : 0;

  const itemsListTransition =
    !isNewSlideIndex || !(speed || delay)
      ? 'none'
      : `transform ${speed}ms ${easing} ${delay}ms`;
  const itemsListTranslateX =
    disableNav || !windowWidth
      ? 0
      : activeSlideIndexOffset -
        positionIndexOffset +
        offsetCorrectionForCenterMode +
        offsetCorrectionForEdgeSlides +
        offsetCorrectionForInfiniteMode;
  const itemsListTransform = windowWidth
    ? `translateX(-${itemsListTranslateX}px)`
    : 'none';

  const visibleSlidesState = windowWidth
    ? getVisibleSidesItems({
        activeSlideIndex,
        itemsListRef,
        innerRef,
        offsetCorrectionForCenterMode,
        infinite,
        indexOfFirstSlideInDOM: firstRenderSlideIndexRef.current,
        offsetCorrectionForInfiniteMode,
        itemsToShow,
      })
    : {
        visibleSlides: [],
        isFirstSlideVisible: false,
        isLastSlideVisible: false,
      };

  const getNextSlideIndex = useCallback(
    (direction: NavDirection) => {
      if (direction === 'forward') {
        const nextSlideIndex = activeSlideIndex + itemsToScroll;
        const isOnEnd = nextSlideIndex > lastSlideIndex;
        // eslint-disable-next-line no-nested-ternary
        const newSlideIndex = isOnEnd
          ? infinite
            ? nextSlideIndex - lastSlideIndex - 1
            : activeSlideIndex
          : nextSlideIndex;

        return newSlideIndex;
      }

      if (direction === 'backward') {
        const nextSlideIndex = activeSlideIndex - itemsToScroll;
        const isOnStart = nextSlideIndex < 0;
        // eslint-disable-next-line no-nested-ternary
        const newSlideIndex = isOnStart
          ? infinite
            ? lastSlideIndex + 1 + nextSlideIndex
            : activeSlideIndex
          : nextSlideIndex;

        return newSlideIndex;
      }

      return activeSlideIndex;
    },
    [activeSlideIndex, itemsToScroll, lastSlideIndex, infinite]
  );

  const updateActiveSlideIndex = useCallback(
    (newActiveSlideIndex: number, direction: NavDirection) => {
      directionRef.current = direction;
      itemsListRef.current!.style.transition =
        speed || delay ? `transform ${speed}ms ${easing} ${delay}ms` : 'none';

      if (
        newActiveSlideIndex !== activeSlideIndex ||
        persistentChangeCallbacks
      ) {
        clearTimeout(autoplayTimerRef.current);

        onRequestChange(
          newActiveSlideIndex,
          getVisibleSidesItems({
            activeSlideIndex: newActiveSlideIndex,
            indexOfFirstSlideInDOM: positionIndex,
            infinite,
            innerRef,
            itemsListRef,
            offsetCorrectionForCenterMode,
            offsetCorrectionForInfiniteMode,
            itemsToShow,
          })
        );
      } else {
        itemsListDragStartPosRef.current = 0;

        itemsListRef.current!.style.transform = `translateX(-${
          offsetCorrectionForCenterMode +
          offsetCorrectionForInfiniteMode +
          (infinite ? 0 : itemsListTranslateX)
        }px)`;
      }
    },
    [
      persistentChangeCallbacks,
      activeSlideIndex,
      offsetCorrectionForCenterMode,
      delay,
      easing,
      speed,
      onRequestChange,
      offsetCorrectionForInfiniteMode,
      infinite,
      itemsListTranslateX,
      positionIndex,
      itemsToShow,
    ]
  );

  const startAutoplay = useCallback(() => {
    if (autoplay) {
      clearTimeout(autoplayTimerRef.current);

      autoplayTimerRef.current = setTimeout(() => {
        updateActiveSlideIndex(
          getNextSlideIndex(autoplayDirection),
          autoplayDirection
        );
      }, delay);
    }
  }, [
    autoplay,
    autoplayDirection,
    updateActiveSlideIndex,
    getNextSlideIndex,
    delay,
  ]);

  const handleContainerClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isListDraggingRef.current) {
        event.preventDefault();
        event.stopPropagation();

        if (containerOnClickCapture) {
          containerOnClickCapture(event);
        }
      }
    },
    [containerOnClickCapture]
  );

  const handleBackwardBtnClick = useCallback(() => {
    updateActiveSlideIndex(getNextSlideIndex('backward'), 'backward');
  }, [updateActiveSlideIndex, getNextSlideIndex]);

  const handleItemsListDrag = useCallback(
    // todo: replace any
    (event: any) => {
      isListDraggingRef.current = true;

      const dragPos =
        event.touches && event.touches[0]
          ? event.touches[0].clientX
          : event.clientX;

      const dragPosDiff =
        itemsListDragStartPosRef.current -
        dragPos +
        offsetCorrectionForCenterMode +
        offsetCorrectionForInfiniteMode +
        (infinite ? 0 : itemsListTranslateX);
      const minDragPos = 0;
      const maxDragPos =
        itemsListRef.current!.offsetWidth - innerRef.current!.offsetWidth;
      const itemsListPos = Math.max(
        Math.min(minDragPos, -dragPosDiff),
        -maxDragPos
      );
      itemsListRef.current!.style.transition = 'none';
      itemsListRef.current!.style.transform = `translateX(${itemsListPos}px)`;
    },
    [
      offsetCorrectionForCenterMode,
      offsetCorrectionForInfiniteMode,
      infinite,
      itemsListTranslateX,
    ]
  );

  const handleItemsListDragEnd = useCallback(
    // todo: replace any
    (event: any) => {
      itemsListRef.current!.removeEventListener(
        'mouseout',
        handleItemsListDragEnd
      );
      itemsListRef.current!.removeEventListener(
        'dragstart',
        handleItemsListDragEnd
      );

      document.removeEventListener('mousemove', handleItemsListDrag);
      document.removeEventListener('mouseup', handleItemsListDragEnd);

      document.removeEventListener('touchmove', handleItemsListDrag);
      document.removeEventListener('touchend', handleItemsListDragEnd);

      if (isListDraggingRef.current) {
        const dragPos =
          event.changedTouches && event.changedTouches.length
            ? event.changedTouches[event.changedTouches.length - 1].clientX
            : event.clientX;

        const mousePosDiff = itemsListDragStartPosRef.current - dragPos;

        if (mousePosDiff > activeSlideWidth / 2) {
          updateActiveSlideIndex(getNextSlideIndex('forward'), 'forward');
        } else if (mousePosDiff < -activeSlideWidth / 2) {
          updateActiveSlideIndex(getNextSlideIndex('backward'), 'backward');
        } else {
          updateActiveSlideIndex(activeSlideIndex, 'forward');
        }
      }
    },
    [
      activeSlideIndex,
      activeSlideWidth,
      updateActiveSlideIndex,
      getNextSlideIndex,
      handleItemsListDrag,
    ]
  );

  const handleItemsListMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      clearTimeout(autoplayTimerRef.current);

      if (!isListDraggingRef.current) {
        itemsListDragStartPosRef.current = event.clientX;

        document.addEventListener('mousemove', handleItemsListDrag);
        document.addEventListener('mouseup', handleItemsListDragEnd);

        itemsListRef.current!.addEventListener(
          'mouseout',
          handleItemsListDragEnd
        );
        itemsListRef.current!.addEventListener(
          'dragstart',
          handleItemsListDragEnd
        );
      }

      if (onItemsListMouseDown) {
        onItemsListMouseDown(event);
      }
    },
    [handleItemsListDrag, handleItemsListDragEnd, onItemsListMouseDown]
  );

  const handleItemsListTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      clearTimeout(autoplayTimerRef.current);

      if (!isListDraggingRef.current) {
        itemsListDragStartPosRef.current = event.touches[0].clientX;

        document.addEventListener('touchmove', handleItemsListDrag);
        document.addEventListener('touchend', handleItemsListDragEnd);
      }

      if (onItemsListTouchStart) {
        onItemsListTouchStart(event);
      }
    },
    [handleItemsListDrag, handleItemsListDragEnd, onItemsListTouchStart]
  );

  const handleItemsListTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      setPositionIndex(activeSlideIndex);

      if (onItemsListTransitionEnd) {
        onItemsListTransitionEnd(event);
      }
    },
    [activeSlideIndex, onItemsListTransitionEnd]
  );

  const handleForwardBtnClick = useCallback(() => {
    updateActiveSlideIndex(getNextSlideIndex('forward'), 'forward');
  }, [updateActiveSlideIndex, getNextSlideIndex]);

  const getSlideItemOnClick = ({
    direction,
    index,
    onClick,
  }: {
    direction: NavDirection;
    index: number;
    onClick?: any;
  }) => {
    const slideItemOnClick = (event: MouseEvent) => {
      const forwardDirectionValue = activeSlideIndex < index ? 'forward' : '';
      const backwardDirectionValue = activeSlideIndex > index ? 'backward' : '';

      updateActiveSlideIndex(
        index,
        direction || forwardDirectionValue || backwardDirectionValue
      );

      if (onClick) {
        onClick(event);
      }
    };

    return slideItemOnClick;
  };

  const renderSlidesItems = (
    items: ReactElement<any>[],
    startIndex: number,
    isDisableNav?: boolean
  ) =>
    items.map((item, index) => {
      const {
        props: {
          className: itemClassName = '',
          onClick: itemOnClick = null,
          style: itemStyle = {},
          ...itemComponentProps
        } = {},
        ...slideComponentData
      } = item;

      // eslint-disable-next-line no-nested-ternary
      const direction = infinite
        ? renderedSlidesCountRef.current >= slidesItems.length
          ? 'forward'
          : 'backward'
        : index >= activeSlideIndex
        ? 'forward'
        : 'backward';

      const isActive = index + startIndex === activeSlideIndex;
      const isVisible = visibleSlidesState.visibleSlides.find(
        (slide) => slide.slideIndex === index + startIndex
      );

      const className = `${itemClassName} ${direction} ${
        isActive ? activeSlideClassName : ''
      } ${isVisible ? visibleSlideClassName : ''}`;
      const style = {
        ...itemStyle,
        ...(isVisible ? visibleSlideStyle : {}),
        ...(isActive ? activeSlideStyle : {}),
        boxSizing: 'border-box',
        margin: 0,
      };
      const onClick =
        !isDisableNav && updateOnItemClick
          ? getSlideItemOnClick({
              direction,
              index: index + startIndex,
              onClick: itemOnClick,
            })
          : itemOnClick;
      const slideProps = {
        role: 'tabpanel',
        className,
        style,
        onClick,
        ...itemComponentProps,
        ...(isVisible ? visibleSlideProps : {}),
        ...(isActive ? activeSlideProps : {}),
      };

      renderedSlidesCountRef.current += 1;

      return {
        props: slideProps,
        ...slideComponentData,
      };
    });

  useEffect(() => {
    itemsListDragStartPosRef.current = 0;
    if (positionIndex === activeSlideIndex) {
      isListDraggingRef.current = false;
    }
    directionRef.current = '';

    if (activeSlideIndex !== positionIndex) {
      if (!speed && !delay) {
        setPositionIndex(activeSlideIndex);
      }
    } else {
      if (onAfterChange) {
        onAfterChange(activeSlideIndex, positionIndex);
      }

      if (
        infinite ||
        (autoplayDirection === 'forward' &&
          activeSlideIndex !== lastSlideIndex) ||
        (autoplayDirection === 'backward' && activeSlideIndex !== 0)
      ) {
        startAutoplay();
      }
    }

    return () => {
      clearTimeout(autoplayTimerRef.current);
    };
  }, [
    positionIndex,
    activeSlideIndex,
    onAfterChange,
    speed,
    delay,
    startAutoplay,
    infinite,
    lastSlideIndex,
    autoplayDirection,
  ]);

  useEffect(() => {
    if (windowWidth) {
      startAutoplay();
    }

    return () => {
      clearTimeout(autoplayTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowWidth]);

  useEffect(() => {
    const itemsListRefDOMElement = itemsListRef.current;

    function handleWindowResize() {
      clearTimeout(resizeTimerRef.current);
      clearTimeout(autoplayTimerRef.current);

      resizeTimerRef.current = setTimeout(() => {
        if (windowWidth !== window.innerWidth) {
          setWindowWidth(window.innerWidth);
        }
      }, 400);
    }

    if (windowWidth !== window.innerWidth) {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(resizeTimerRef.current);
      window.removeEventListener('resize', handleWindowResize);

      document.removeEventListener('mousemove', handleItemsListDrag);
      document.removeEventListener('mouseup', handleItemsListDragEnd);
      document.removeEventListener('touchmove', handleItemsListDrag);
      document.removeEventListener('touchend', handleItemsListDragEnd);

      itemsListRefDOMElement!.removeEventListener(
        'mouseout',
        handleItemsListDragEnd
      );
      itemsListRefDOMElement!.removeEventListener(
        'dragstart',
        handleItemsListDragEnd
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleItemsListDrag, handleItemsListDragEnd]);

  renderedSlidesCountRef.current = 0;
  firstRenderSlideIndexRef.current = positionIndex;

  return (
    <div
      onClickCapture={handleContainerClickCapture}
      style={{
        display: 'flex',
        flexFlow: 'row wrap',
        boxSizing: 'border-box',
        justifyContent: 'center',
        width: `100%`,
        ...containerStyle,
      }}
      {...containerProps}
      ref={containerRef}
    >
      {showBackwardBtn && !hideNav && (
        <button
          {...backwardBtnProps}
          type="button"
          onClick={
            ((itemsListTranslateX === 0 && disableNavIfEdgeVisible) ||
              (activeSlideIndex === 0 && disableNavIfEdgeActive)) &&
            !infinite
              ? undefined
              : handleBackwardBtnClick
          }
          disabled={
            typeof backwardBtnProps.disabled === 'boolean'
              ? backwardBtnProps.disabled
              : !!(
                  ((itemsListTranslateX === 0 && disableNavIfEdgeVisible) ||
                    (activeSlideIndex === 0 && disableNavIfEdgeActive)) &&
                  !infinite
                )
          }
        >
          {backwardBtnChildren}
        </button>
      )}

      <div
        {...innerProps}
        style={{
          ...innerStyle,
          display: 'flex',
          boxSizing: 'border-box',
          flexFlow: 'row wrap',
          padding: '0',
          overflow: 'hidden',
          // eslint-disable-next-line no-nested-ternary
          maxWidth: innerMaxWidth ? `${innerMaxWidth}px` : undefined,
          flex: !innerMaxWidth ? `1 0` : undefined,
        }}
        ref={innerRef}
      >
        {/* eslint-disable-next-line jsx-a11y/mouse-events-have-key-events */}
        <div
          {...itemsListProps}
          style={{
            ...itemsListStyle,
            display: 'flex',
            boxSizing: 'border-box',
            outline: 'none',
            transition: itemsListTransition,
            transform: itemsListTransform,
          }}
          onTouchStart={!disableNav ? handleItemsListTouchStart : undefined}
          onMouseDown={!disableNav ? handleItemsListMouseDown : undefined}
          onTransitionEnd={
            speed || delay ? handleItemsListTransitionEnd : undefined
          }
          tabIndex={-1}
          role="presentation"
          ref={itemsListRef}
        >
          {infinite &&
            renderSlidesItems(
              slidesItems.slice(positionIndex),
              positionIndex,
              disableNav
            )}
          {renderSlidesItems(slidesItems, 0, disableNav)}
          {infinite && renderSlidesItems(slidesItems, 0, disableNav)}
          {infinite &&
            renderSlidesItems(
              slidesItems.slice(0, positionIndex),
              0,
              disableNav
            )}
        </div>
      </div>

      {showForwardBtn && !hideNav && (
        <button
          {...forwardBtnProps}
          type="button"
          onClick={
            ((itemsListTranslateX === itemsListMaxTranslateX &&
              disableNavIfEdgeVisible) ||
              (activeSlideIndex === lastSlideIndex &&
                disableNavIfEdgeActive)) &&
            !infinite
              ? undefined
              : handleForwardBtnClick
          }
          disabled={
            typeof forwardBtnProps.disabled === 'boolean'
              ? forwardBtnProps.disabled
              : !!(
                  ((itemsListTranslateX === itemsListMaxTranslateX &&
                    disableNavIfEdgeVisible) ||
                    (activeSlideIndex === lastSlideIndex &&
                      disableNavIfEdgeActive)) &&
                  !infinite
                )
          }
        >
          {forwardBtnChildren}
        </button>
      )}

      {!!showDotsNav && (
        <div
          style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          {...dotsNavContainerProps}
        >
          {Array.from({
            length: Math.ceil(slidesItems.length / itemsToScroll),
          }).map((_item, index) => (
            <button
              type="button"
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              title={`${index}`}
              {...dotsNavBtnProps}
              {...(Math.min(index * itemsToScroll, slidesItems.length - 1) ===
              activeSlideIndex
                ? dotsNavActiveBtnProps
                : {})}
              onClick={() => {
                updateActiveSlideIndex(
                  Math.min(index * itemsToScroll, slidesItems.length - 1),
                  Math.min(index * itemsToScroll, slidesItems.length - 1) >
                    activeSlideIndex
                    ? 'forward'
                    : 'backward'
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ReactSimplyCarousel);
