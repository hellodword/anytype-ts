import * as React from 'react';
import { Smile } from 'ts/component';
import { I } from 'ts/lib';
import { observer, inject } from 'mobx-react';

interface Props extends I.BlockMedia {
	commonStore?: any;
	blockStore?: any;
};

@inject('commonStore')
@inject('blockStore')
@observer
class BlockIcon extends React.Component<Props, {}> {

	render () {
		const { commonStore, blockStore, id } = this.props;
		const { blocks } = blockStore;
		const block = blocks.find((item: I.Block) => { return item.id == id; });
		
		if (!block) {
			return null;
		};
		
		const { content } = block;
		const { icon } = content;
		
		return (
			<React.Fragment>
				<Smile id={'block-icon-' + id} canEdit={true} size={24} icon={icon} className={'c48 ' + (commonStore.menuIsOpen('smile') ? 'active' : '')} />
			</React.Fragment>
		);
	};
	
};

export default BlockIcon;