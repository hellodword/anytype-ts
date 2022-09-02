import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Icon } from 'Component';
import { I, C, DataUtil, Util, Onboarding, focus, keyboard, analytics, history as historyPopup, Storage } from 'Lib';
import { popupStore, detailStore, blockStore, menuStore } from 'Store';
import { observer } from 'mobx-react';

interface Props extends I.BlockComponent {}

const $ = require('jquery');
const Constant = require('json/constant.json');

const BlockType = observer(class BlockType extends React.Component<Props, {}> {

	n: number = 0;

	constructor (props: any) {
		super(props);
		
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onOut = this.onOut.bind(this);
		this.onFocus = this.onFocus.bind(this);
	};

	render (): any {
		const { block } = this.props;
		const items = this.getItems();
		const cn = [ 'wrap', 'focusable', 'c' + block.id ];

		const Item = (item: any) => {
			return (
				<div 
					id={'item-' + item.id} 
					className="item" 
					onClick={(e: any) => { this.onClick(e, item); }} 
					onMouseEnter={(e: any) => { this.onOver(e, item); }} 
					onMouseLeave={this.onOut}
				>
					{item.icon ? <Icon className={item.icon} /> : ''}
					{item.name}
				</div>
			);
		};
		
		return (
			<div className={cn.join(' ')} tabIndex={0} onFocus={this.onFocus} onKeyDown={this.onKeyDown}>
				{items.map((item: any, i: number) => (
					<Item key={i} {...item} />
				))}
			</div>
		);
	};

	componentDidMount () {
		Onboarding.start('typeSelect', this.props.isPopup);
	};

	getItems () {
		const { rootId } = this.props;
		const object = detailStore.get(rootId, rootId, []);
		const items = DataUtil.getObjectTypesForNewObject({ withSet: true, withDefault: true }).filter(it => it.id != object.type);

		items.push({ id: 'menu', icon: 'search', name: 'My types' });

		return items;
	};

	onKeyDown (e: any) {
		const { onKeyDown } = this.props;
		const items = this.getItems();

		keyboard.disableMouse(true);

		keyboard.shortcut('arrowup, arrowleft', e, (pressed: string) => {
			this.n--;

			if (this.n < 0) {
				this.n = items.length - 1;
				this.setHover();

				if (onKeyDown) {
					onKeyDown(e, '', [], { from: 0, to: 0 }, this.props);
				};
			} else {
				this.setHover(items[this.n]);
			};
		});

		keyboard.shortcut('arrowdown, arrowright', e, (pressed: string) => {
			e.preventDefault();

			this.n++;

			if (this.n > items.length - 1) {
				this.n = 0;
				this.setHover();

				if (onKeyDown) {
					onKeyDown(e, '', [], { from: 0, to: 0 }, this.props);
				};
			} else {
				this.setHover(items[this.n]);
			};
		});

		keyboard.shortcut('enter, space', e, (pressed: string) => {
			e.preventDefault();

			if (items[this.n]) {
				this.onClick(e, items[this.n]);
			};
		});
	};
	
	onFocus () {
		const items = this.getItems();

		if (items.length) {
			this.n = 0;
			this.setHover(items[this.n]);
		};
	};

	onOver (e: any, item: any) {
		if (!keyboard.isMouseDisabled) {
			this.setHover(item);
		};
	};

	onOut () {
		if (!keyboard.isMouseDisabled) {
			this.setHover();
		};
	};

	setHover (item?: any) {
		const node = $(ReactDOM.findDOMNode(this));

		node.find('.item.hover').removeClass('hover');
		if (item) {
			node.find('#item-' + item.id).addClass('hover');
		};
	};

	onMenu (e: any) {
		const { rootId, block } = this.props;
		const types = DataUtil.getObjectTypesForNewObject().map(it => it.id);

		menuStore.open('searchObject', {
			element: `#block-${block.id} #item-menu`,
			className: 'big single',
			data: {
				isBig: true,
				rootId: rootId,
				blockId: block.id,
				blockIds: [ block.id ],
				placeholder: 'Change object type',
				placeholderFocus: 'Change object type',
				filters: [
					{ operator: I.FilterOperator.And, relationKey: 'id', condition: I.FilterCondition.In, value: types }
				],
				onSelect: (item: any) => {
					this.onClick(e, item);
				},
				dataSort: (c1: any, c2: any) => {
					let i1 = types.indexOf(c1.id);
					let i2 = types.indexOf(c2.id);

					if (i1 > i2) return 1;
					if (i1 < i2) return -1;
					return 0;
				},
			}
		});
	};

	onClick (e: any, item: any) {
		if (e.persist) {
			e.persist();
		};

		if (item.id == 'menu') {
			this.onMenu(e);
			return;
		};

		const { rootId, isPopup } = this.props;
		const param = {
			type: I.BlockType.Text,
			style: I.TextStyle.Paragraph,
		};
		const namespace = isPopup ? '-popup' : '';

		Util.getScrollContainer(isPopup).scrollTop(0);
		Storage.setScroll('editor' + (isPopup ? 'Popup' : ''), rootId, 0);

		let first = null;

		const create = (template: any) => {

			const onBlock = (id: string) => {
				if (first) {
					const l = first.getLength();
					
					focus.set(first.id, { from: l, to: l });
					focus.apply();
				};

				$(window).trigger('resize.editor' + namespace);
			};

			const onTemplate = () => {
				first = blockStore.getFirstBlock(rootId, 1, it => it.isText());
				if (!first) {
					C.BlockCreate(rootId, '', I.BlockPosition.Bottom, param, (message: any) => { onBlock(message.blockId); });
				} else {
					onBlock(first.id);
				};
			};

			if (template) {
				C.ObjectApplyTemplate(rootId, template.id, onTemplate);
			} else {
				C.ObjectSetObjectType(rootId, item.id, onTemplate);
			};

			analytics.event('CreateObject', {
				route: 'SelectType',
				objectType: item.id,
				layout: template?.layout,
				template: (template && template.isBundledTemplate ? template.id : 'custom'),
			});
		};

		if (item.id == Constant.typeId.set) {
			C.ObjectToSet(rootId, [], (message: any) => {
				if (isPopup) {
					historyPopup.clear();
				};
				DataUtil.objectOpenRoute({ id: message.id, layout: I.ObjectLayout.Set });

				analytics.event('CreateObject', {
					route: 'SelectType',
					objectType: Constant.typeId.set,
					layout: I.ObjectLayout.Set,
				});
			});
		} else {
			DataUtil.checkTemplateCnt([ item.id ], (message: any) => {
				if (message.records.length > 1) {
					popupStore.open('template', { data: { typeId: item.id, onSelect: create } });
				} else {
					create(message.records.length ? message.records[0] : '');
				};
			});
		};
	};

});

export default BlockType;