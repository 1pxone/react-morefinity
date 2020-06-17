import * as React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { MorefinityListLoader, MorefinityContainer, IMorefinityProps } from '../index';
import { useState } from 'react';

const mockedItemHeight = 30;

const itemRenderer = (item: { id: number; text: string }) => {
    return (
        <div
            key={item.id}
            style={{
                height: mockedItemHeight + 'px',
            }}
        >
            {item.text}
        </div>
    );
};

const fetchItems = async (
    offset: number = 0,
    limit: number = 50
): Promise<{ id: number; text: string }[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const _newItems = [];
            for (let i = offset; i < offset + limit; i++) {
                _newItems.push({
                    id: i,
                    text: `${i} Index`,
                });
            }
            resolve(_newItems);
        }, 100);
    });
};

describe('<MorefinityContainer />', () => {
    const MorefinityContainerTest = () => {
        const [items, setItems] = useState<{ id: number; text: string }[]>([
            {
                id: 0,
                text: `${0} Index`,
            },
        ]);
        const [isLoading, setLoading] = useState<boolean>(false);
        const onScrollEnd = async (offset: number) => {
            setLoading(true);
            const res = await fetchItems(offset, 100);
            setItems([...items, ...res]);
            setLoading(false);
        };
        return (
            <div className="App" style={{ height: '290px' }}>
                <MorefinityContainer
                    itemsTotal={20000}
                    isLoading={isLoading}
                    scrollOffset={100}
                    onScrollEnd={onScrollEnd}
                >
                    {items.map(itemRenderer)}
                </MorefinityContainer>
            </div>
        );
    };
    const container = shallow(<MorefinityContainerTest />);

    let wrapper: ShallowWrapper;
    const useEffect = jest.spyOn(React, 'useEffect');
    const mockUseEffect = () => {
        useEffect.mockImplementation(f => f());
    };

    const loader: React.ReactElement = <p>loading</p>;

    const props: IMorefinityProps = {
        isLoading: false,
        itemsTotal: 2000,
        scrollOffset: 50,
        loader,
        height: 400,
        onScrollEnd: jest.fn(),
    };

    test('should pass scrollOffset prop', () => {
        expect(container.find(MorefinityContainer).props().scrollOffset).toBe(100);
    });

    test('should request items with start offset and limit from props', () => {
        mockUseEffect();
        wrapper = shallow(<MorefinityContainer {...props} />);
        expect(props.onScrollEnd).toBeCalledTimes(0);
    });

    test('container height should be equal to passed property', () => {
        wrapper = shallow(<MorefinityContainer {...props} />);
        expect(wrapper.find('div').props().height).toBe(props.height);
    });

    test('should render <MorefinityContainer />', () => {
        expect(wrapper.length).toBe(1);
    });

    test('should render <MorefinityListLoader />', () => {
        expect(wrapper.find('MorefinityListLoader').length).toBe(1);
    });
    test('should render <MorefinityListLoader /> and use loader props', () => {
        expect(wrapper.find(MorefinityListLoader).props().loader).toBe(props.loader);
    });
});
