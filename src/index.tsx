import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useRef, RefObject } from 'react';
import { IObservableSize, useObservedSize } from '@1px.one/react-hooks/lib/use-resize-observer';

function useDebouncedState<T>(initialValue: T, delay: number = 50): [T, (newValue: T) => void] {
    const [state, setState] = useState<T>(initialValue);
    const timeoutRef = useRef<number | false>();
    const setStateDebounced = useCallback((newValue: T) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current =
            typeof window !== 'undefined' && window.setTimeout(() => setState(newValue), delay);
    }, []);
    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);
    return [state, setStateDebounced];
}

export interface IMorefinityProps {
    isLoading?: boolean;
    loader?: React.ReactElement;
    height?: number;
    itemsTotal?: number;
    scrollOffset?: number;
    onScrollEnd?(offset: number): void;
}

export interface IMorefinityPropsItemProps {
    currentHeight: number;
    index: number;
    onHeightChange(height: number): void;
}

interface IItemMeta {
    [key: string]: number;
}

const getMorefinityElementStyle = (top: number | string): React.CSSProperties => {
    return {
        position: 'absolute',
        width: '100%',
        left: 0,
        top,
    };
};

export const MorefinityItem: React.FC<IMorefinityPropsItemProps> = ({
    index,
    currentHeight,
    onHeightChange,
    children,
}) => {
    const {
        ref,
        size: { height },
    } = useObservedSize<HTMLDivElement>() as {
        ref: RefObject<HTMLDivElement>;
        size: IObservableSize;
    };
    useEffect(() => {
        if (height !== 0 && height !== currentHeight && typeof height !== 'undefined') {
            onHeightChange(height);
        }
    }, [height, currentHeight]);
    return (
        <div key={index} ref={ref} className={`item_${index}`}>
            {children}
        </div>
    );
};

const getTotalMeasuredHeight = (pageMeta: IItemMeta) => {
    const itemsMetaValues = Object.values(pageMeta);
    return itemsMetaValues.reduce((acc, page) => acc + page, 0);
};

interface IMorefinityContainerLoaderProps {
    loader?: React.ReactElement;
    isLoading?: boolean;
    listHeight: number;
}

export const MorefinityListLoader = ({
    loader,
    isLoading,
    listHeight,
}: IMorefinityContainerLoaderProps) => {
    const element = loader ? loader : <span>Loading...</span>;
    return isLoading ? <div style={getMorefinityElementStyle(listHeight)}>{element}</div> : null;
};

export const MorefinityContainer: React.FC<IMorefinityProps> = React.memo(
    ({ isLoading, height, itemsTotal, onScrollEnd, scrollOffset = 0, loader, children }) => {
        const [offsetHeight, setOffsetHeight] = useState(0);

        const [_scrollTop, _setScrollTop] = useDebouncedState(0, 50);

        const { ref: containerRef, size } = useObservedSize<HTMLDivElement>() as {
            ref: RefObject<HTMLDivElement>;
            size: IObservableSize;
        };

        const [itemsMeta, setItemMeta] = useState<IItemMeta>({});

        const totalMeasuredHeight = useMemo(() => getTotalMeasuredHeight(itemsMeta), [itemsMeta]);

        const avgItemHeight = useMemo(() => {
            const itemsMetaValues = Object.values(itemsMeta);
            return itemsMetaValues.length ? totalMeasuredHeight / itemsMetaValues.length : 0;
        }, [totalMeasuredHeight, itemsMeta]);

        const [minPredicted, setMinPredictedIndex] = useState(0);

        const [maxPredicted, setMaxPredictedIndex] = useState(0);

        useEffect(() => {
            const predictionRation = (_scrollTop - offsetHeight) / avgItemHeight;
            const roundingFunction = predictionRation > 1 ? Math.ceil : Math.floor;

            const newMinPredicted = Math.max(
                _scrollTop
                    ? Math.min(roundingFunction(predictionRation), React.Children.count(children))
                    : 0,
                0
            );
            const positivePredictedCount = avgItemHeight
                ? Math.ceil(offsetHeight / avgItemHeight)
                : 1;

            const newMaxPredicted = Math.min(
                avgItemHeight
                    ? (_scrollTop
                          ? Math.ceil(_scrollTop / avgItemHeight) + positivePredictedCount
                          : Math.ceil(offsetHeight / avgItemHeight)) + positivePredictedCount
                    : 1,
                React.Children.count(children)
            );

            if (minPredicted !== newMinPredicted) {
                setMinPredictedIndex(newMinPredicted);
            }
            if (maxPredicted !== newMaxPredicted) {
                setMaxPredictedIndex(newMaxPredicted);
            }
        }, [_scrollTop, offsetHeight, avgItemHeight, React.Children.count(children)]);

        const listHeight = useMemo(() => React.Children.count(children) * avgItemHeight, [
            children,
            avgItemHeight,
        ]);

        const isScrollEnd = useMemo(() => {
            return (
                Boolean(offsetHeight) &&
                Boolean(_scrollTop) &&
                Boolean(listHeight) &&
                offsetHeight + _scrollTop >= listHeight - scrollOffset
            );
        }, [offsetHeight, _scrollTop, listHeight, scrollOffset]);

        const notAllLoaded = useMemo(
            () => typeof itemsTotal !== 'undefined' && React.Children.count(children) < itemsTotal,
            [children, itemsTotal]
        );
        useEffect(() => {
            if (containerRef.current) {
                setOffsetHeight(containerRef?.current?.offsetHeight);
            }
        }, [containerRef.current, size]);

        useEffect(() => {
            if (
                (isScrollEnd || (!isScrollEnd && listHeight < offsetHeight)) &&
                !isLoading &&
                notAllLoaded &&
                typeof onScrollEnd === 'function'
            ) {
                onScrollEnd(React.Children.count(children));
            }
        }, [isLoading, isScrollEnd, notAllLoaded, listHeight, offsetHeight, onScrollEnd]);

        const onHeightChange = useCallback(
            (itemIndex: number) => (updatedHeight: number) => {
                setItemMeta(prevState => ({
                    ...prevState,
                    [itemIndex]: updatedHeight,
                }));
            },
            [itemsMeta]
        );
        const getCurrentMeasuredHeight = useCallback((index: number) => itemsMeta[index], [
            itemsMeta,
        ]);

        const renderItems = useCallback(() => {
            return React.Children.map(children, (child, index) => {
                if (index >= minPredicted && index <= maxPredicted) {
                    return (
                        <MorefinityItem
                            key={index}
                            index={index}
                            currentHeight={getCurrentMeasuredHeight(index)}
                            onHeightChange={onHeightChange(index)}
                        >
                            {child}
                        </MorefinityItem>
                    );
                } else {
                    return null;
                }
            });
        }, [listHeight, children, minPredicted, maxPredicted]);

        const pageWrapperStyles: React.CSSProperties = useMemo(() => {
            const offset = Math.max(minPredicted - 1, 0) * avgItemHeight;
            return {
                position: 'absolute',
                height: listHeight - offset,
                top: offset,
                width: '100%',
            };
        }, [listHeight, minPredicted, avgItemHeight, offsetHeight]);

        const onScroll = (e: React.UIEvent<HTMLElement>) => {
            _setScrollTop(e.currentTarget.scrollTop);
        };

        return (
            <div
                style={{ position: 'relative', height: height ?? 'inherit' }}
                ref={containerRef}
                onScroll={onScroll}
            >
                <div style={pageWrapperStyles}>{renderItems()}</div>
                <MorefinityListLoader
                    loader={loader}
                    isLoading={isLoading}
                    listHeight={listHeight}
                />
            </div>
        );
    }
);