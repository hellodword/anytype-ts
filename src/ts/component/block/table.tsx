import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Icon } from 'ts/component';
import { I, C, keyboard, DataUtil, Util, Mark } from 'ts/lib';
import { observer } from 'mobx-react';
import { menuStore, blockStore } from 'ts/store';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import arrayMove from 'array-move';
import { throttle } from 'lodash';

import Row from './table/row';

interface Props extends I.BlockComponent {};

const $ = require('jquery');
const raf = require('raf');
const Constant = require('json/constant.json');

const PADDING = 46;

const BlockTable = observer(class BlockTable extends React.Component<Props, {}> {

	_isMounted: boolean = false;
	offsetX: number = 0;
	cache: any = {};
	width: number = 0;
	oldIndex: number = -1;
	newIndex: number = -1;
	timeout: number = 0;
	scrollX: number = 0;

	constructor (props: any) {
		super(props);

		this.onSortStart = this.onSortStart.bind(this);
		this.onSortEndColumn = this.onSortEndColumn.bind(this);
		this.onSortEndRow = this.onSortEndRow.bind(this);
		this.onHandleClick = this.onHandleClick.bind(this);
		this.onCellClick = this.onCellClick.bind(this);
		this.onCellFocus = this.onCellFocus.bind(this);
		this.onCellBlur = this.onCellBlur.bind(this);
		this.onCellEnter = this.onCellEnter.bind(this);
		this.onCellLeave = this.onCellLeave.bind(this);
		this.onOptions = this.onOptions.bind(this);
		this.onResizeStart = this.onResizeStart.bind(this);
		this.onDragStartColumn = this.onDragStartColumn.bind(this);
		this.getData = this.getData.bind(this);
		this.onScroll = this.onScroll.bind(this);
		this.onPlusV = this.onPlusV.bind(this);
		this.onPlusH = this.onPlusH.bind(this);
	};

	render () {
		const { rootId, block, readonly } = this.props;
		const { rows, columns } = this.getData();
		const cn = [ 'wrap', 'focusable', 'c' + block.id ];

		// Subscriptions
		columns.forEach((column: I.Block) => {
			const { width } = column.fields || {};
		});

		const RowSortableElement = SortableElement((item: any) => (
			<Row 
				{...this.props}
				{...item} 
				index={item.block.idx}
				getData={this.getData}
				onOptions={this.onOptions}
				onHandleClick={this.onHandleClick}
				onCellClick={this.onCellClick}
				onCellFocus={this.onCellFocus}
				onCellBlur={this.onCellBlur}
				onCellEnter={this.onCellEnter}
				onCellLeave={this.onCellLeave}
				onResizeStart={this.onResizeStart}
				onDragStartColumn={this.onDragStartColumn}
			/>
		));

		const TableSortableContainer = SortableContainer((item: any) => (
			<div id="table" className="table">
				<div className="rows">
					{rows.map((row: any, i: number) => {
						row.idx = i;
						return <RowSortableElement key={'row' + row.id} index={i} block={row} />;
					})}
				</div>

				<div className="plusButton vertical">
					<Icon onClick={this.onPlusV} />
				</div>
				<div className="plusButton horizontal">
					<Icon onClick={this.onPlusH} />
				</div>
			</div>
		));

		return (
			<div 
				id="wrap"
				tabIndex={0} 
				className={cn.join(' ')}
			>
				<div id="scrollWrap" className="scrollWrap" onScroll={this.onScroll}>
					<TableSortableContainer 
						axis="y" 
						lockAxis="y"
						lockToContainerEdges={true}
						transitionDuration={150}
						distance={10}
						useDragHandle={true}
						onSortStart={this.onSortStart}
						onSortEnd={this.onSortEndRow}
						helperClass="isDraggingRow"
						helperContainer={() => { return $(`#block-${block.id} .table`).get(0); }}
					/>
				</div>
			</div>
		);
	};
	
	componentDidMount () {
		this._isMounted = true;
		this.initSize();
		this.resize();
		this.rebind();
	};

	componentDidUpdate () {
		const node = $(ReactDOM.findDOMNode(this));
		const wrap = node.find('#scrollWrap');

		this.initSize();
		this.resize();

		wrap.scrollLeft(this.scrollX);
	};
	
	componentWillUnmount () {
		this._isMounted = false;
		this.unbind();

		window.clearTimeout(this.timeout);
	};

	unbind () {
		const { block } = this.props;
		$(window).off('resize.' + block.id);
	};

	rebind () {
		const { block } = this.props;
		const win = $(window);

		this.unbind();
		win.on('resize.' + block.id, () => { this.resize(); });
	};

	getData () {
		const { rootId, block } = this.props;
		const childrenIds = blockStore.getChildrenIds(rootId, block.id);
		const children = blockStore.getChildren(rootId, block.id);
		const rowContainer = children.find(it => it.isLayoutTableRows());
		const columnContainer = children.find(it => it.isLayoutTableColumns());
		const columns = columnContainer ? blockStore.getChildren(rootId, columnContainer.id, it => it.isTableColumn()) : [];
		const rows = rowContainer ? blockStore.getChildren(rootId, rowContainer.id, it => it.isTableRow()) : [];

		return { columnContainer, columns, rowContainer, rows };
	};

	getRowColumn (cellId: string) {
		const { rootId } = this.props;
		const { columns } = this.getData();
		const cellElement = blockStore.getMapElement(rootId, cellId);
		const rowElement = blockStore.getMapElement(rootId, cellElement.parentId);
		const idx = rowElement.childrenIds.indexOf(cellId);
		
		return { rowId: cellElement.parentId, columnId: columns[idx].id };
	};

	onOptions (e: any, id: string) {
		if (!this._isMounted) {
			return;
		};

		e.preventDefault();
		e.stopPropagation();

		const { rootId } = this.props;
		const current = blockStore.getLeaf(rootId, id);

		if (!current) {
			return;
		};

		const node = $(ReactDOM.findDOMNode(this));
		const { rowContainer, rows, columnContainer, columns } = this.getData();
		const subIds = [ 'select2', 'blockColor', 'blockBackground' ];
		const optionsColumn = this.optionsColumn(id);
		const optionsRow = this.optionsRow(id);
		const optionsAlign = this.optionsAlign(id);
		const optionsColor = this.optionsColor(id);

		let menuContext: any = null;
		let menuParam: any = {
			component: 'select',
			onOpen: (context: any) => {
				menuContext = context;
				this.onOptionsOpen(id);
			},
			onClose: () => {
				this.onOptionsClose();
			},
			subIds: subIds,
		};

		let options: any[] = [];
		let element: any = null;
		let blockIds: string[] = [];
		let childrenIds: any[] = [];
		let targetRowId: string = '';
		let targetColumnId: string = '';

		switch (current.type) {
			case I.BlockType.TableRow:
				targetRowId = current.id;

				options = options.concat(optionsRow);
				options = options.concat(optionsColor);

				blockIds = blockStore.getChildrenIds(rootId, current.id);

				element = node.find(`#block-${id}`).first();
				menuParam = Object.assign(menuParam, {
					element,
				});
				break;

			case I.BlockType.TableColumn:
				targetColumnId = current.id;

				options = options.concat(optionsColumn);
				options = options.concat(optionsColor);

				const idx = columns.findIndex(it => it.id == current.id);
				if (idx >= 0) {
					rows.forEach(row => {
						const childrenIds = blockStore.getChildrenIds(rootId, row.id);
						blockIds = blockIds.concat([ childrenIds[idx] ]);
					});
				};

				element = node.find(`.cell.column${id}`).first();
				menuParam = Object.assign(menuParam, {
					element,
					offsetX: element.outerWidth() + 2,
					offsetY: -element.outerHeight(),
				});
				break;

			default:
				options = options.concat(optionsColumn);
				options = options.concat(optionsRow);
				options = options.concat(optionsColor);

				blockIds = [ current.id ];

				const { rowId, columnId } = this.getRowColumn(current.id);

				targetRowId = rowId;
				targetColumnId = columnId;

				menuParam = Object.assign(menuParam, {
					rect: { x: e.pageX, y: e.pageY, width: 1, height: 1 },
					offsetY: 10,
					horizontal: I.MenuDirection.Center,
				});
				break;
		};
		options = options.concat(optionsAlign);

		menuParam = Object.assign(menuParam, {
			data: {
				options: options,
				onOver: (e: any, item: any) => {
					if (!item.arrow) {
						menuStore.closeAll(subIds);
						return;
					};

					let menuId = '';
					let menuParam: any = {
						element: `#${menuContext.getId()} #item-${item.id}`,
						offsetX: menuContext.getSize().width,
						vertical: I.MenuDirection.Center,
						isSub: true,
						data: {
							rootId, 
							rebind: menuContext.ref.rebind,
						}
					};

					switch (item.id) {
						case 'horizontal':
							menuId = 'select2';
							menuParam.component = 'select';
							menuParam.data = Object.assign(menuParam.data, {
								options: this.optionsHAlign(),
								onSelect: (e: any, el: any) => {
									C.BlockListSetAlign(rootId, blockIds, el.id);
									menuContext.close();
								}
							});
							break;

						case 'vertical':
							menuId = 'select2';
							menuParam.component = 'select';
							menuParam.data = Object.assign(menuParam.data, {
								options: this.optionsVAlign(),
								onSelect: (e: any, el: any) => {
									C.BlockListSetVerticalAlign(rootId, blockIds, el.id);
									menuContext.close();
								}
							});
							break;

						case 'color':
							menuId = 'blockColor';
							menuParam.data = Object.assign(menuParam.data, {
								onChange: (id: string) => {
									C.BlockTextListSetColor(rootId, blockIds, id);
									menuContext.close();
								}
							});
							break;

						case 'background':
							menuId = 'blockBackground';
							menuParam.data = Object.assign(menuParam.data, {
								onChange: (id: string) => {
									C.BlockListSetBackgroundColor(rootId, blockIds, id);
									menuContext.close();
								}
							});
							break;

						case 'style':
							menuId = 'select2';
							menuParam.component = 'select';
							menuParam.data = Object.assign(menuParam.data, {
								options: this.optionsStyle(id),
								onSelect: (e: any, el: any) => {
									C.BlockTextListSetMark(rootId, blockIds, { type: el.id, param: '', range: { from: 0, to: 0 } });
									menuContext.close();
								}
							});
							break;
					};

					menuStore.closeAll(subIds, () => {
						menuStore.open(menuId, menuParam);
					});
				},
				onSelect: (e: any, item: any) => {
					if (item.arrow) {
						return;
					};

					let childrenIds: string[] = [];
					let oldIndex = 0;
					let newIndex = 0;

					switch (item.id) {
						case 'columnBefore':
						case 'columnAfter':
							C.BlockTableColumnCreate(rootId, targetColumnId, (item.id == 'columnBefore' ? I.BlockPosition.Left : I.BlockPosition.Right));
							break;

						case 'columnMoveLeft':
						case 'columnMoveRight':
							childrenIds = blockStore.getChildrenIds(rootId, columnContainer.id);
							oldIndex = childrenIds.indexOf(current.id);
							newIndex = item.id == 'columnMoveLeft' ? oldIndex - 1 : oldIndex + 1;

							this.onSortEndColumn(oldIndex, newIndex);
							break;

						case 'columnRemove':
							C.BlockTableColumnDelete(rootId, targetColumnId);
							break;

						case 'columnCopy':
							C.BlockTableColumnDuplicate(rootId, targetColumnId, targetColumnId, I.BlockPosition.Bottom);
							break;

						case 'rowBefore':
						case 'rowAfter':
							C.BlockTableRowCreate(rootId, targetRowId, (item.id == 'rowBefore' ? I.BlockPosition.Top : I.BlockPosition.Bottom));
							break;

						case 'rowMoveTop':
						case 'rowMoveBottom':
							childrenIds = blockStore.getChildrenIds(rootId, rowContainer.id);
							oldIndex = childrenIds.indexOf(current.id);
							newIndex = item.id == 'rowMoveTop' ? oldIndex - 1 : oldIndex + 1;

							this.onSortEndRow({ oldIndex, newIndex });
							break;

						case 'rowCopy':
							C.BlockListDuplicate(rootId, [ targetRowId ], targetRowId, I.BlockPosition.Bottom);
							break;

						case 'rowRemove':
							C.BlockListDelete(rootId, [ targetRowId ]);
							break;
					};
				}
			},
		});

		menuStore.open('select1', menuParam);
	};

	onOptionsOpen (id: string) {
		if (!this._isMounted) {
			return;
		};

		const { rootId } = this.props;
		const current = blockStore.getLeaf(rootId, id);

		if (!current) {
			return;
		};

		const node = $(ReactDOM.findDOMNode(this));
		const table = node.find('#table');

		this.onOptionsClose();

		switch (current.type) {
			case I.BlockType.TableColumn:
				const cells = table.find(`.cell.column${id}`);

				cells.addClass('isHighlightedColumn');
				cells.first().addClass('isFirst');
				cells.last().addClass('isLast');
				break;

			case I.BlockType.TableRow:
				table.find(`#block-${id}`).addClass('isHighlightedRow');
				break;

			default:
				table.find(`#block-${id}`).addClass('isHighlightedCell');
				break;
		};
	};

	onOptionsClose () {
		if (!this._isMounted) {
			return;
		};

		const node = $(ReactDOM.findDOMNode(this));
		node.find('.isHighlightedColumn').removeClass('isHighlightedColumn isFirst isLast');
		node.find('.isHighlightedRow').removeClass('isHighlightedRow');
		node.find('.isHighlightedCell').removeClass('isHighlightedCell');
	};

	onPlusV (e: any) {
		const { rootId } = this.props;
		const { columns } = this.getData();

		C.BlockTableColumnCreate(rootId, columns[columns.length - 1].id, I.BlockPosition.Right);
	};

	onPlusH (e: any) {
		const { rootId } = this.props;
		const { rows } = this.getData();

		C.BlockTableRowCreate(rootId, rows[rows.length - 1].id, I.BlockPosition.Bottom);
	};

	onHandleClick (e: any, id: string) {
		this.onOptions(e, id);
	};

	onCellFocus (e: any, id: string) {
		this.setEditing(id);
		this.preventSelect(true);
	};

	onCellBlur (e: any, id: string) {
		this.setEditing('');
		this.preventSelect(false);
	};

	onCellClick (e: any, id: string) {
		this.onCellFocus(e, id);
	};

	onCellEnter (e: any, rowIdx: number, columnIdx: number, id: string) {
		const { rows, columns } = this.getData();
		const node = $(ReactDOM.findDOMNode(this));
		const plusV = node.find('.plusButton.vertical');
		const plusH = node.find('.plusButton.horizontal');

		if (columnIdx == columns.length - 1) {
			plusV.addClass('active');
		};

		if (rowIdx == rows.length - 1) {
			plusH.addClass('active');
		};
	};

	onCellLeave (e: any, rowIdx: number, columnIdx: number, id: string) {
		const { rows, columns } = this.getData();
		const node = $(ReactDOM.findDOMNode(this));
		const plusV = node.find('.plusButton.vertical');
		const plusH = node.find('.plusButton.horizontal');

		if (columnIdx == columns.length - 1) {
			plusV.removeClass('active');
		};

		if (rowIdx == rows.length - 1) {
			plusH.removeClass('active');
		};
	};

	setEditing (id: string) {
		if (!this._isMounted) {
			return;
		};

		const node = $(ReactDOM.findDOMNode(this));
		
		node.find('.cell.isEditing').removeClass('isEditing');
		if (id) {
			node.find(`#block-${id}`).addClass('isEditing');
		};
	};

	onResizeStart (e: any, id: string) {
		if (!this._isMounted) {
			return;
		};

		e.preventDefault();
		e.stopPropagation();

		const win = $(window);
		const body = $('body');
		const node = $(ReactDOM.findDOMNode(this));
		const el = node.find(`.cell.column${id}`);

		if (el.length) {
			this.offsetX = el.first().offset().left;
		};

		body.addClass('colResize');
		win.unbind('mousemove.table mouseup.table');
		win.on('mousemove.table', throttle((e: any) => { this.onResizeMove(e, id); }, 40));
		win.on('mouseup.table', (e: any) => { this.onResizeEnd(e, id); });

		keyboard.setResize(true);
	};

	onResizeMove (e: any, id: string) {
		e.preventDefault();
		e.stopPropagation();

		const { columns } = this.getData();
		const idx = columns.findIndex(it => it.id == id);
		const widths = this.getColumnWidths();

		widths[idx] = this.checkWidth(e.pageX - this.offsetX);

		this.setColumnsWidths(widths);
		this.resize();
	};

	onResizeEnd (e: any, id: string) {
		const { rootId } = this.props;
		const width = Math.max(Constant.size.table.min, Math.min(Constant.size.table.max, e.pageX - this.offsetX));

		C.BlockListSetFields(rootId, [
			{ blockId: id, fields: { width } },
		]);

		$(window).unbind('mousemove.table mouseup.table');
		$('body').removeClass('colResize');
		keyboard.setResize(false);
	};

	getColumnWidths (): number[] {
		const { columns } = this.getData();
		const ret = [];

		columns.forEach((it: I.Block) => {
			ret.push(this.checkWidth(it.fields.width || Constant.size.table.default));
		});

		return ret;
	};

	setColumnsWidths (widths: number[]) {
		if (!this._isMounted) {
			return;
		};

		const node = $(ReactDOM.findDOMNode(this));
		const rows = node.find('.row');

		rows.css({ gridTemplateColumns: widths.map(it => it + 'px').join(' ') });
	};

	onDragStartColumn (e: any, id: string) {
		e.stopPropagation();

		const { rows, columns } = this.getData();
		const win = $(window);
		const node = $(ReactDOM.findDOMNode(this));
		const table = $('<div />').addClass('table isClone');
		const widths = this.getColumnWidths();
		const idx = columns.findIndex(it => it.id == id);

		rows.forEach((row: I.Block, i: number) => {
			const rowElement = $('<div />').addClass('row');
			const cell = $(node.find(`.cell.column${id}`).get(i));
			const clone = cell.clone();

			clone.css({ height: cell.outerHeight() });

			rowElement.append(clone);
			table.append(rowElement);
		});

		table.css({ width: widths[idx], zIndex: 10000, position: 'fixed', left: -10000, top: -10000 });
		node.append(table);

		$(document).off('dragover').on('dragover', (e: any) => { e.preventDefault(); });
		e.dataTransfer.setDragImage(table.get(0), table.outerWidth(), -3);

		win.on('drag.board', throttle((e: any) => { this.onDragMoveColumn(e, id); }, 40));
		win.on('dragend.board', (e: any) => { this.onDragEnd(e); });

		this.initCache();
		this.setEditing('');
		this.onOptionsOpen(id);
		this.preventSelect(true);
		this.preventDrop(true);
	};

	onDragMoveColumn (e: any, id: string) {
		if (!this._isMounted) {
			return;
		};

		const node = $(ReactDOM.findDOMNode(this));
		const { columns } = this.getData();

		this.oldIndex = columns.findIndex(it => it.id == id);

		let hoverId = '';
		let isLeft = false;

		for (let i = 0; i < columns.length; ++i) {
			const column = columns[i];
			const rect = this.cache[column.id];

			if (id == column.id) {
				continue;
			};

			if (rect && Util.rectsCollide({ x: e.pageX, y: 0, width: this.width, height: 1 }, rect)) {
				isLeft = e.pageX <= rect.x + rect.width / 2;
				hoverId = column.id;
				
				this.newIndex = isLeft ? rect.index : rect.index + 1;
				break;
			};
		};

		window.clearTimeout(this.timeout);
		this.timeout = window.setTimeout(() => {
			node.find('.cell.isOver').removeClass('isOver left right');

			if (hoverId) {
				node.find(`.cell.column${hoverId}`).addClass('isOver ' + (isLeft ? 'left' : 'right'));
			};
		}, 40);

		this.newIndex = Math.max(0, this.newIndex);
		this.newIndex = Math.min(columns.length - 1, this.newIndex);
	};

	onDragEnd (e: any) {
		e.preventDefault();

		const node = $(ReactDOM.findDOMNode(this));

		this.cache = {};
		this.onSortEndColumn(this.oldIndex, this.newIndex);
		this.preventSelect(false);
		this.preventDrop(false);

		window.clearTimeout(this.timeout);
		node.find('.table.isClone').remove();
		node.find('.cell.isOver').removeClass('isOver left right');
	};

	onScroll (e: any) {
		if (!this._isMounted) {
			return;
		};

		const node = $(ReactDOM.findDOMNode(this));
		const wrap = node.find('#scrollWrap');

		this.scrollX = wrap.scrollLeft();
	};

	initCache () {
		if (!this._isMounted) {
			return;
		};

		this.cache = {};

		const { columns } = this.getData();
		const node = $(ReactDOM.findDOMNode(this));

		columns.forEach((column: I.Block, i: number) => {
			const cell = node.find(`.cell.column${column.id}`).first();
			const p = cell.offset();

			this.cache[column.id] = {
				x: p.left,
				y: 0,
				height: 1,
				width: cell.outerWidth(),
				index: i,
			};
		});
	};

	alignHIcon (v: I.BlockHAlign): string {
		let icon = '';
		switch (v) {
			default:
			case I.BlockHAlign.Left:		 icon = 'left'; break;
			case I.BlockHAlign.Center:	 icon = 'center'; break;
			case I.BlockHAlign.Right:	 icon = 'right'; break;
		};
		return icon;
	};

	alignVIcon (v: I.BlockVAlign): string {
		let icon = '';
		switch (v) {
			default:
			case I.BlockVAlign.Top:		 icon = 'top'; break;
			case I.BlockVAlign.Center:	 icon = 'center'; break;
			case I.BlockVAlign.Bottom:	 icon = 'bottom'; break;
		};
		return icon;
	};

	onSortStart () {
		$('body').addClass('grab');
		this.preventSelect(true);
	};

	onSortEndColumn (oldIndex: number, newIndex: number): void {
		const { rootId } = this.props;
		const { columns } = this.getData();
		const oldColumn = columns[oldIndex];
		const newColumn = columns[newIndex];

		if (!oldColumn || !newColumn) {
			return;
		};

		const position = newIndex < oldIndex ? I.BlockPosition.Left : I.BlockPosition.Right;
		C.BlockTableColumnMove(rootId, oldColumn.id, newColumn.id, position);

		$('body').removeClass('grab');
		this.preventSelect(false);
	};

	onSortEndRow (result: any) {
		const { oldIndex, newIndex } = result;
		const { rootId } = this.props;
		const { rowContainer } = this.getData();
		const childrenIds = blockStore.getChildrenIds(rootId, rowContainer.id);
		const current = childrenIds[oldIndex];
		const target = childrenIds[newIndex];
		const position = newIndex < oldIndex ? I.BlockPosition.Top : I.BlockPosition.Bottom;

		if (current == target) {
			return;
		};

		blockStore.updateStructure(rootId, rowContainer.id, arrayMove(childrenIds, oldIndex, newIndex));
		C.BlockListMoveToExistingObject(rootId, rootId, [ current ], target, position);

		$('body').removeClass('grab');
		this.preventSelect(false);
	};

	preventSelect (v: boolean) {
		const { dataset } = this.props;
		const { selection } = dataset || {};

		if (selection) {
			selection.preventSelect(v);
		};
	};

	preventDrop (v: boolean) {
		const { dataset } = this.props;
		const { preventCommonDrop } = dataset || {};

		preventCommonDrop(v);
	};

	initSize () {
		if (!this._isMounted) {
			return;
		};

		const { columns } = this.getData();
		const node = $(ReactDOM.findDOMNode(this));
		const rows = node.find('.row');
		const sizes = [];

		columns.forEach((it: I.Block) => {
			sizes.push(this.checkWidth(it.fields.width || Constant.size.table.default));
		});

		rows.css({ gridTemplateColumns: sizes.map(it => it + 'px').join(' ') });
	};

	resize () {
		if (!this._isMounted) {
			return;
		};

		const { isPopup, block, getWrapperWidth } = this.props;
		const node = $(ReactDOM.findDOMNode(this));
		const obj = $(`#block-${block.id}`);
		const container = $(isPopup ? '#popupPage #innerWrap' : '#page.isFull');
		const ww = container.width();
		const mw = ww - PADDING * 2;
		const wrapperWidth = getWrapperWidth();
		const offset = Constant.size.blockMenu + 10;
		const wrap = node.find('#scrollWrap');
		const row = node.find('.row').first();

		let width = offset;
		String(row.css('grid-template-columns') || '').split(' ').forEach((it: string) => {
			width += parseInt(it);
		});

		width > mw ? wrap.addClass('withScroll') : wrap.removeClass('withScroll');
		width = Math.min(mw, width);

		obj.css({
			width: (width >= wrapperWidth) ? width : 'auto',
			marginLeft: (width >= wrapperWidth) ? Math.min(0, (wrapperWidth - width) / 2) + offset / 2 : '',
		});
	};

	checkWidth (w: number) {
		const { min, max } = Constant.size.table;
		return Math.max(min, Math.min(max, w));
	};

	optionsRow (id: string) {
		const { rootId } = this.props;
		const { rows } = this.getData();
		const idx = rows.findIndex(it => it.id == id);
		const length = rows.length;
		const options: any[] = [
			{ id: 'rowBefore', icon: 'table-insert-top', name: 'Row before' },
			{ id: 'rowAfter', icon: 'table-insert-bottom', name: 'Row after' },
		];

		if (idx > 0) {
			options.push({ id: 'rowMoveTop', icon: 'table-move-top', name: 'Move row up' });
		};
		if (idx < length - 1) {
			options.push({ id: 'rowMoveBottom', icon: 'table-move-bottom', name: 'Move row down' });
		};

		options.push({ id: 'rowCopy', icon: 'copy', name: 'Duplicate row' });

		if (length > 1) {
			options.push({ id: 'rowRemove', icon: 'remove', name: 'Delete row' });
		};

		options.push({ isDiv: true });
		return options;
	};

	optionsColumn (id: string) {
		const { columns } = this.getData();
		const idx = columns.findIndex(it => it.id == id);
		const length = columns.length;
		const options: any[] = [
			{ id: 'columnBefore', icon: 'table-insert-left', name: 'Column before' },
			{ id: 'columnAfter', icon: 'table-insert-right', name: 'Column after' },
		];

		if (idx > 0) {
			options.push({ id: 'columnMoveLeft', icon: 'table-move-left', name: 'Move column left' });
		};
		if (idx < length - 1) {
			options.push({ id: 'columnMoveRight', icon: 'table-move-right', name: 'Move column right' });
		};

		options.push({ id: 'columnCopy', icon: 'copy', name: 'Duplicate column' });

		if (length > 1) {
			options.push({ id: 'columnRemove', icon: 'remove', name: 'Delete column' });
		};

		options.push({ isDiv: true });
		return options;
	};

	optionsColor (id: string) {
		const { rootId } = this.props;
		const current = blockStore.getLeaf(rootId, id);

		if (!current) {
			return;
		};

		const innerColor = <div className={[ 'inner', 'textColor textColor-' + (current.content.color || 'default') ].join(' ')} />;
		const innerBackground = <div className={[ 'inner', 'bgColor bgColor-' + (current.bgColor || 'default') ].join(' ')} />;

		return [
			{ id: 'color', icon: 'color', name: 'Color', inner: innerColor, arrow: true },
			{ id: 'background', icon: 'color', name: 'Background', inner: innerBackground, arrow: true },
			{ id: 'style', icon: 'customize', name: 'Style', arrow: true },
			{ isDiv: true },
		];
	};

	optionsAlign (id: string) {
		const { rootId } = this.props;
		const current = blockStore.getLeaf(rootId, id);

		if (!current) {
			return;
		};

		return [
			{ id: 'horizontal', icon: 'align ' + this.alignHIcon(current.hAlign), name: 'Horizontal align', arrow: true },
			{ id: 'vertical', icon: 'align ' + this.alignVIcon(current.vAlign), name: 'Vertical align', arrow: true },
		];
	};

	optionsHAlign () {
		return [
			{ id: I.BlockHAlign.Left, name: 'Left' },
			{ id: I.BlockHAlign.Center, name: 'Center' },
			{ id: I.BlockHAlign.Right, name: 'Right' },
		].map((it: any) => {
			it.icon = 'align ' + this.alignHIcon(it.id);
			return it;
		});
	};

	optionsVAlign () {
		return [
			{ id: I.BlockVAlign.Top, name: 'Top' },
			{ id: I.BlockVAlign.Center, name: 'Center' },
			{ id: I.BlockVAlign.Bottom, name: 'Bottom' },
		].map((it: any) => {
			it.icon = 'align ' + this.alignVIcon(it.id);
			return it;
		});
	};

	optionsStyle (id: string) {
		const { rootId } = this.props;
		const current = blockStore.getLeaf(rootId, id);

		if (!current) {
			return;
		};

		const length = current.getLength();

		const ret: any[] = [
			{ id: I.MarkType.Bold, icon: 'bold', name: 'Bold' },
			{ id: I.MarkType.Italic, icon: 'italic', name: 'Italic' },
			{ id: I.MarkType.Strike, icon: 'strike', name: 'Strikethrough' },
		];

		return ret.map(it => {
			const mark = Mark.getInRange(current.content.marks, it.id, { from: 0, to: length });
			it.checkbox = !!mark;
			return it;
		});
	};

});

export default BlockTable;