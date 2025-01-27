import arrayMove from 'array-move';
import { I, M, C, S, U, J, Relation, translate } from 'Lib';

class Dataview {

	viewGetRelations (rootId: string, blockId: string, view: I.View): I.ViewRelation[] {
		const { config } = S.Common;

		if (!view) {
			return [];
		};

		const order: any = {};

		let relations = U.Common.objectCopy(S.Record.getObjectRelations(rootId, blockId)).filter(it => it);
		let o = 0;

		if (!config.debug.hiddenObject) {
			relations = relations.filter(it => (it.relationKey == 'name') || !it.isHidden);
		};

		(view.relations || []).filter(it => it).forEach(it => {
			order[it.relationKey] = o++;
		});

		relations.forEach(it => {
			if (it && (undefined === order[it.relationKey])) {
				order[it.relationKey] = o++;
			};
		});

		relations.sort((c1: any, c2: any) => {
			const o1 = order[c1.relationKey];
			const o2 = order[c2.relationKey];

			if (o1 > o2) return 1;
			if (o1 < o2) return -1;
			return 0;
		});

		const ret = relations.filter(it => it).map(relation => {
			const vr = (view.relations || []).filter(it => it).find(it => it.relationKey == relation.relationKey) || {};

			if (relation.relationKey == 'name') {
				vr.isVisible = true;
			};

			return new M.ViewRelation({
				...vr,
				relationKey: relation.relationKey,
				width: Relation.width(vr.width, relation.format),
			});
		});

		return U.Common.arrayUniqueObjects(ret, 'relationKey');
	};

	relationAdd (rootId: string, blockId: string, relationKey: string, index: number, view?: I.View, callBack?: (message: any) => void) {
		if (!view) {
			return;
		};

		C.BlockDataviewRelationAdd(rootId, blockId, [ relationKey ], (message: any) => {
			if (message.error.code) {
				return;
			};

			const rel: any = view.getRelation(relationKey) || {};

			rel.relationKey = relationKey;
			rel.width = rel.width || J.Size.dataview.cell.default;
			rel.isVisible = true;

			C.BlockDataviewViewRelationReplace(rootId, blockId, view.id, relationKey, rel, (message: any) => {
				if (index >= 0) {
					const newView = S.Record.getView(rootId, blockId, view.id);
					const oldIndex = (newView.relations || []).findIndex(it => it.relationKey == relationKey);
					
					let keys = newView.relations.map(it => it.relationKey);
					if (oldIndex < 0) {
						keys.splice(index, 0, relationKey);
					} else {
						keys = arrayMove(keys, oldIndex, index);
					};

					C.BlockDataviewViewRelationSort(rootId, blockId, view.id, keys, callBack);
				} else {
					if (callBack) {
						callBack(message);
					};
				};
			});
		});
	};

	getData (param: any, callBack?: (message: any) => void) {
		param = Object.assign({
			rootId: '',
			blockId: '',
			newViewId: '',
			keys: J.Relation.default,
			offset: 0,
			limit: 0,
			ignoreWorkspace: false,
			sources: [],
			clear: false,
			collectionId: '',
			filters: [],
			sorts: [],
		}, param);

		const { rootId, blockId, newViewId, keys, offset, limit, clear, collectionId } = param;
		const block = S.Block.getLeaf(rootId, blockId);
		const view = S.Record.getView(rootId, blockId, newViewId);
		
		if (!view) {
			return;
		};

		const subId = S.Record.getSubId(rootId, blockId);
		const { viewId } = S.Record.getMeta(subId, '');
		const viewChange = newViewId != viewId;
		const meta: any = { offset };
		const filters = U.Common.objectCopy(view.filters).concat(param.filters || []);
		const sorts = U.Common.objectCopy(view.sorts).concat(param.sorts || []);

		filters.push({ operator: I.FilterOperator.And, relationKey: 'layout', condition: I.FilterCondition.NotIn, value: U.Object.excludeFromSet() });

		if (viewChange) {
			meta.viewId = newViewId;
		};
		if (viewChange || clear) {
			S.Record.recordsSet(subId, '', []);
		};

		S.Record.metaSet(subId, '', meta);

		if (block) {
			const el = block.content.objectOrder.find(it => (it.viewId == view.id) && (it.groupId == ''));
			const objectIds = el ? el.objectIds || [] : [];

			if (objectIds.length) {
				sorts.unshift({ relationKey: '', type: I.SortType.Custom, customOrder: objectIds });
			};
		};

		U.Data.searchSubscribe({
			...param,
			subId,
			filters: filters.map(it => this.filterMapper(view, it)),
			sorts: sorts.map(it => this.filterMapper(view, it)),
			keys,
			limit,
			offset,
			collectionId,
			ignoreDeleted: true,
			ignoreHidden: true,
		}, callBack);
	};

	filterMapper (view: any, it: any) {
		const relation = S.Record.getRelationByKey(it.relationKey);
		const vr = view.getRelation(it.relationKey);

		if (relation) {
			it.format = relation.format;
		};
		if (vr && vr.includeTime) {
			it.includeTime = true;
		};

		return it;
	};

	getView (rootId: string, blockId: string, viewId?: string): I.View {
		let view = null;

		if (!viewId) {
			viewId = S.Record.getMeta(S.Record.getSubId(rootId, blockId), '').viewId;
		};

		if (viewId) {
			view = S.Record.getView(rootId, blockId, viewId);
		};

		if (!view) {
			const views = S.Record.getViews(rootId, blockId);
			if (views.length) {
				view = views[0];
			};
		};

		return view;
	};

	isCollection (rootId: string, blockId: string): boolean {
		const object = S.Detail.get(rootId, rootId, [ 'layout' ], true);
		const isInline = !U.Object.isSystemLayout(object.layout);

		if (!isInline) {
			return object.layout == I.ObjectLayout.Collection;
		};

		const block = S.Block.getLeaf(rootId, blockId);
		if (!block) {
			return false;
		};

		const { targetObjectId, isCollection } = block.content;
		const target = targetObjectId ? S.Detail.get(rootId, targetObjectId, [ 'layout' ], true) : null;

		return target ? target.layout == I.ObjectLayout.Collection : isCollection;
	};

	loadGroupList (rootId: string, blockId: string, viewId: string, object: any) {
		const view = this.getView(rootId, blockId, viewId);
		const block = S.Block.getLeaf(rootId, blockId);

		if (!view || !block) {
			return;
		};

		const subId = S.Record.getGroupSubId(rootId, block.id, 'groups');
		const isCollection = object.layout == I.ObjectLayout.Collection;

		S.Record.groupsClear(rootId, block.id);

		const relation = S.Record.getRelationByKey(view.groupRelationKey);
		if (!relation) {
			return;
		};

		const groupOrder: any = {};
		const el = block.content.groupOrder.find(it => it.viewId == view.id);

		if (el) {
			el.groups.forEach(it => groupOrder[it.groupId] = it);
		};

		C.ObjectGroupsSubscribe(S.Common.space, subId, view.groupRelationKey, view.filters, object.setOf || [], isCollection ? object.id : '', (message: any) => {
			if (message.error.code) {
				return;
			};

			const groups = (message.groups || []).map((it: any) => {
				let bgColor = 'grey';
				let value: any = it.value;
				let option: any = null;

				switch (relation.format) {
					case I.RelationType.MultiSelect:
						value = Relation.getArrayValue(value);
						if (value.length) {
							option = S.Detail.get(J.Constant.subId.option, value[0]);
							bgColor = option?.color;
						};
						break;

					case I.RelationType.Select:
						option = S.Detail.get(J.Constant.subId.option, value);
						bgColor = option?.color;
						break;
				};

				it.isHidden = groupOrder[it.id]?.isHidden;
				it.bgColor = groupOrder[it.id]?.bgColor || bgColor;
				return it;
			});

			S.Record.groupsSet(rootId, block.id, this.applyGroupOrder(rootId, block.id, view.id, groups));
		});
	};

	getGroupFilter (relation: any, value: any): I.Filter {
		const filter: any = { operator: I.FilterOperator.And, relationKey: relation.relationKey };

		switch (relation.format) {
			default: {
				filter.condition = I.FilterCondition.Equal;
				filter.value = value;
				break;
			};

			case I.RelationType.Select: {
				filter.condition = value ? I.FilterCondition.Equal : I.FilterCondition.Empty;
				filter.value = value ? value : null;
				break;
			};

			case I.RelationType.MultiSelect: {
				value = Relation.getArrayValue(value);
				filter.condition = value.length ? I.FilterCondition.ExactIn : I.FilterCondition.Empty;
				filter.value = value.length ? value : null;
				break;
			};
		};
		return filter;
	};

	getGroups (rootId: string, blockId: string, viewId: string, withHidden: boolean) {
		const groups = U.Common.objectCopy(S.Record.getGroups(rootId, blockId));
		const ret = this.applyGroupOrder(rootId, blockId, viewId, groups);

		return !withHidden ? ret.filter(it => !it.isHidden) : ret;
	};

	groupUpdate (rootId: string, blockId: string, viewId: string, groups: any[]) {
		const block = S.Block.getLeaf(rootId, blockId);
		if (!block) {
			return;
		};

		const el = block.content.groupOrder.find(it => it.viewId == viewId);
		if (el) {
			el.groups = groups;
		};

		S.Block.updateContent(rootId, blockId, block.content);
	};

	groupOrderUpdate (rootId: string, blockId: string, viewId: string, groups: any[]) {
		const block = S.Block.getLeaf(rootId, blockId);
		if (!block) {
			return;
		};

		const groupOrder = U.Common.objectCopy(block.content.groupOrder);
		const idx = groupOrder.findIndex(it => it.viewId == viewId);

		if (idx >= 0) {
			groupOrder[idx].groups = groups;
		} else {
			groupOrder.push({ viewId, groups });
		};

		S.Block.updateContent(rootId, blockId, { groupOrder });
	};

	applyGroupOrder (rootId: string, blockId: string, viewId: string, groups: any[]) {
		if (!viewId || !groups.length) {
			return groups;
		};

		const block = S.Block.getLeaf(rootId, blockId);
		if (!block) {
			return groups;
		};

		const el = block.content.groupOrder.find(it => it.viewId == viewId);
		const groupOrder: any = {};

		if (el) {
			el.groups.forEach(it => groupOrder[it.groupId] = it);
		};

		groups.sort((c1: any, c2: any) => {
			const idx1 = groupOrder[c1.id]?.index;
			const idx2 = groupOrder[c2.id]?.index;
			if (idx1 > idx2) return 1;
			if (idx1 < idx2) return -1;
			return 0;
		});

		return groups;
	};

	applyObjectOrder (rootId: string, blockId: string, viewId: string, groupId: string, records: string[]): string[] {
		records = records || [];

		if (!viewId || !records.length) {
			return records;
		};

		const block = S.Block.getLeaf(rootId, blockId);
		if (!block) {
			return records;
		};

		const el = block.content.objectOrder.find(it => (it.viewId == viewId) && (groupId ? it.groupId == groupId : true));
		if (!el) {
			return records;
		};

		const objectIds = el.objectIds || [];

		records.sort((c1: any, c2: any) => {
			const idx1 = objectIds.indexOf(c1);
			const idx2 = objectIds.indexOf(c2);

			if (idx1 > idx2) return 1;
			if (idx1 < idx2) return -1;
			return 0;
		});

		return records;
	};

	defaultViewName (type: I.ViewType): string {
		return translate(`viewName${type}`);
	};

	getDetails (rootId: string, blockId: string, objectId: string, viewId?: string, groupId?: string): any {
		const relations = Relation.getSetOfObjects(rootId, objectId, I.ObjectLayout.Relation);
		const view = this.getView(rootId, blockId, viewId);
		const conditions = [
			I.FilterCondition.Equal,
			I.FilterCondition.GreaterOrEqual,
			I.FilterCondition.LessOrEqual,
			I.FilterCondition.In,
			I.FilterCondition.AllIn,
		];
		const details: any = {};

		if (relations.length) {
			relations.forEach(it => {
				details[it.relationKey] = Relation.formatValue(it, details[it.relationKey] || null, true);
			});
		};

		if (view.groupRelationKey && ('undefined' == typeof(details[view.groupRelationKey]))) {
			if (groupId) {
				const group = S.Record.getGroup(rootId, blockId, groupId);
				if (group) {
					details[view.groupRelationKey] = group.value;
				};
			};

			if (view.type == I.ViewType.Calendar) {
				details[view.groupRelationKey] = U.Date.now();
			};
		};

		for (const filter of view.filters) {
			if (!conditions.includes(filter.condition)) {
				continue;
			};

			const value = Relation.getTimestampForQuickOption(filter.value, filter.quickOption);
			if (!value) {
				continue;
			};

			const relation = S.Record.getRelationByKey(filter.relationKey);
			if (relation && !relation.isReadonlyValue) {
				details[filter.relationKey] = Relation.formatValue(relation, value, true);
			};
		};

		return details;
	};

	getTypeId (rootId: string, blockId: string, objectId: string, viewId?: string) {
		const view = this.getView(rootId, blockId, viewId);
		const types = Relation.getSetOfObjects(rootId, objectId, I.ObjectLayout.Type);
		const relations = Relation.getSetOfObjects(rootId, objectId, I.ObjectLayout.Relation);
		const isAllowedDefaultType = this.isCollection(rootId, blockId) || !!Relation.getSetOfObjects(rootId, objectId, I.ObjectLayout.Relation).map(it => it.id).length;

		let typeId = '';
		if (types.length) {
			typeId = types[0].id;
		} else
		if (relations.length) {
			for (const item of relations) {
				if (item.objectTypes.length) {
					const first = S.Record.getTypeById(item.objectTypes[0]);

					if (first && !U.Object.isFileLayout(first.recommendedLayout) && !U.Object.isSystemLayout(first.recommendedLayout)) {
						typeId = first.id;
						break;
					};
				};
			};
		};
		if (view && view.defaultTypeId && isAllowedDefaultType) {
			typeId = view.defaultTypeId;
		};
		if (!typeId) {
			typeId = S.Common.type;
		};

		return typeId;
	};

	getCreateTooltip (rootId: string, blockId: string, objectId: string, viewId: string): string {
		const isCollection = this.isCollection(rootId, blockId);

		if (isCollection) {
			return translate('blockDataviewCreateNewTooltipCollection');
		} else {
			const typeId = this.getTypeId(rootId, blockId, objectId, viewId);
			const type = S.Record.getTypeById(typeId);

			if (type) {
				return U.Common.sprintf(translate('blockDataviewCreateNewTooltipType'), type.name);
			};
		};
		return translate('commonCreateNewObject');
	};

	viewUpdate (rootId: string, blockId: string, viewId: string, param: Partial<I.View>, callBack?: (message: any) => void) {
		const view = U.Common.objectCopy(S.Record.getView(rootId, blockId, viewId));
		if (view) {
			C.BlockDataviewViewUpdate(rootId, blockId, view.id, Object.assign(view, param), callBack);
		};
	};

	getCoverObject (subId: string, object: any, relationKey: string): any {
		if (!relationKey) {
			return null;
		};

		const value = Relation.getArrayValue(object[relationKey]);
		const layouts = [
			I.ObjectLayout.Image,
			I.ObjectLayout.Audio,
			I.ObjectLayout.Video,
		];

		let ret = null;
		if (relationKey == J.Relation.pageCover) {
			ret = object;
		} else {
			for (const id of value) {
				const file = S.Detail.get(subId, id, []);
				if (file._empty_ || !layouts.includes(file.layout)) {
					continue;
				};

				ret = file;
				break;
			};
		};

		if (!ret || ret._empty_) {
			return null;
		};

		if (!ret.coverId && !ret.coverType && !layouts.includes(ret.layout)) {
			return null;
		};

		return ret;
	};

};

export default new Dataview();
